//! 应用数据的持久化:一个 SQLite 文件里的键值表,按命名空间(ns)分组。
//! 前端的设置、书架(书、封面、进度、对话)和 AI 缓存都存在这里,不再放在浏览器存储里。
//! 值一律是字节:文本按 UTF-8 存,二进制(EPUB、封面)原样存。

use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct Db(pub Mutex<Connection>);

/// 二进制分块上传时暂存还没收完的内容,收到最后一块才一次性写入数据库。
#[derive(Default)]
pub struct Staging(Mutex<HashMap<(String, String), Vec<u8>>>);

pub fn open(path: &std::path::Path) -> rusqlite::Result<Connection> {
  let conn = Connection::open(path)?;
  init(&conn)?;
  Ok(conn)
}

fn init(conn: &Connection) -> rusqlite::Result<()> {
  // WAL:读写不互相阻塞,断电时也不会留下写了一半的文件
  conn.pragma_update(None, "journal_mode", "WAL")?;
  conn.execute_batch(
    "CREATE TABLE IF NOT EXISTS kv (
       ns    TEXT NOT NULL,
       key   TEXT NOT NULL,
       value BLOB NOT NULL,
       PRIMARY KEY (ns, key)
     ) WITHOUT ROWID",
  )
}

fn get(conn: &Connection, ns: &str, key: &str) -> rusqlite::Result<Option<Vec<u8>>> {
  conn
    .query_row("SELECT value FROM kv WHERE ns = ?1 AND key = ?2", params![ns, key], |r| r.get(0))
    .optional()
}

fn set(conn: &Connection, ns: &str, key: &str, value: &[u8]) -> rusqlite::Result<()> {
  conn.execute(
    "INSERT INTO kv (ns, key, value) VALUES (?1, ?2, ?3)
     ON CONFLICT (ns, key) DO UPDATE SET value = excluded.value",
    params![ns, key, value],
  )?;
  Ok(())
}

fn del(conn: &mut Connection, ns: &str, keys: &[String]) -> rusqlite::Result<()> {
  let tx = conn.transaction()?;
  for key in keys {
    tx.execute("DELETE FROM kv WHERE ns = ?1 AND key = ?2", params![ns, key])?;
  }
  tx.commit()
}

fn keys(conn: &Connection, ns: &str, prefix: &str) -> rusqlite::Result<Vec<String>> {
  let mut stmt = conn.prepare("SELECT key FROM kv WHERE ns = ?1 AND substr(key, 1, ?2) = ?3 ORDER BY key")?;
  let rows = stmt.query_map(params![ns, prefix.chars().count() as i64, prefix], |r| r.get(0))?;
  rows.collect()
}

fn lock<'a>(db: &'a State<Db>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
  db.0.lock().map_err(|_| "数据库被占用".to_string())
}

fn err(e: impl std::fmt::Display) -> String {
  e.to_string()
}

#[tauri::command]
pub fn kv_get_text(db: State<Db>, ns: String, key: String) -> Result<Option<String>, String> {
  let conn = lock(&db)?;
  get(&conn, &ns, &key)
    .map_err(err)?
    .map(|bytes| String::from_utf8(bytes).map_err(err))
    .transpose()
}

#[tauri::command]
pub fn kv_set_text(db: State<Db>, ns: String, key: String, value: String) -> Result<(), String> {
  let conn = lock(&db)?;
  set(&conn, &ns, &key, value.as_bytes()).map_err(err)
}

// 二进制(EPUB、封面)按块传输,每块是 base64 字符串,走普通的 JSON 命令。
// 不用原始字节请求体:Tauri 在 Android 上不支持读取请求体,那条通道只在桌面可用。

/// 二进制内容的字节数;不存在返回 None。
#[tauri::command]
pub fn kv_bytes_len(db: State<Db>, ns: String, key: String) -> Result<Option<u64>, String> {
  let conn = lock(&db)?;
  conn
    .query_row("SELECT length(value) FROM kv WHERE ns = ?1 AND key = ?2", params![ns, key], |r| r.get::<_, i64>(0))
    .optional()
    .map(|n| n.map(|n| n as u64))
    .map_err(err)
}

/// 读取 [offset, offset + len) 这一段,返回 base64。
#[tauri::command]
pub fn kv_bytes_get(db: State<Db>, ns: String, key: String, offset: u64, len: u64) -> Result<String, String> {
  let conn = lock(&db)?;
  let bytes: Vec<u8> = conn
    .query_row(
      "SELECT substr(value, ?3, ?4) FROM kv WHERE ns = ?1 AND key = ?2",
      params![ns, key, offset as i64 + 1, len as i64],
      |r| r.get(0),
    )
    .map_err(err)?;
  Ok(STANDARD.encode(bytes))
}

/// 上传一块。offset 为 0 表示从头开始(丢弃之前没传完的),块必须按顺序到达;last 为真时写入数据库。
#[tauri::command]
pub fn kv_bytes_put(db: State<Db>, staging: State<Staging>, ns: String, key: String, offset: u64, chunk: String, last: bool) -> Result<(), String> {
  let data = STANDARD.decode(chunk).map_err(err)?;
  let mut pending = staging.0.lock().map_err(|_| "暂存区被占用".to_string())?;
  let id = (ns.clone(), key.clone());
  let buf = pending.entry(id.clone()).or_default();
  if offset == 0 {
    buf.clear();
  }
  let have = buf.len() as u64;
  if have != offset {
    pending.remove(&id);
    return Err(format!("分块顺序不对:已收到 {have} 字节,这一块从 {offset} 开始"));
  }
  buf.extend_from_slice(&data);
  if last {
    let bytes = pending.remove(&id).unwrap_or_default();
    let conn = lock(&db)?;
    set(&conn, &ns, &key, &bytes).map_err(err)?;
  }
  Ok(())
}

#[tauri::command]
pub fn kv_del(db: State<Db>, ns: String, keys: Vec<String>) -> Result<(), String> {
  let mut conn = lock(&db)?;
  del(&mut conn, &ns, &keys).map_err(err)
}

#[tauri::command]
pub fn kv_keys(db: State<Db>, ns: String, prefix: String) -> Result<Vec<String>, String> {
  let conn = lock(&db)?;
  keys(&conn, &ns, &prefix).map_err(err)
}

/// 在应用数据目录里打开(或创建)数据库并交给 Tauri 管理。
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  let dir = app.path().app_data_dir()?;
  std::fs::create_dir_all(&dir)?;
  app.manage(Db(Mutex::new(open(&dir.join("kotonoha.db"))?)));
  app.manage(Staging::default());
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn mem() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    init(&conn).unwrap();
    conn
  }

  #[test]
  fn set_get_overwrite_delete() {
    let mut c = mem();
    assert_eq!(get(&c, "a", "k").unwrap(), None);
    set(&c, "a", "k", b"one").unwrap();
    set(&c, "a", "k", b"two").unwrap();
    assert_eq!(get(&c, "a", "k").unwrap().as_deref(), Some(&b"two"[..]));
    del(&mut c, "a", &["k".into(), "missing".into()]).unwrap();
    assert_eq!(get(&c, "a", "k").unwrap(), None);
  }

  #[test]
  fn namespaces_are_separate() {
    let c = mem();
    set(&c, "a", "k", b"1").unwrap();
    set(&c, "b", "k", b"2").unwrap();
    assert_eq!(get(&c, "a", "k").unwrap().as_deref(), Some(&b"1"[..]));
    assert_eq!(get(&c, "b", "k").unwrap().as_deref(), Some(&b"2"[..]));
  }

  #[test]
  fn binary_and_long_unicode_keys_round_trip() {
    let c = mem();
    let blob: Vec<u8> = (0..=255).collect();
    let key = format!("tr|openai-compatible|模型|简体中文|{}", "あ".repeat(500));
    set(&c, "cache", &key, &blob).unwrap();
    assert_eq!(get(&c, "cache", &key).unwrap(), Some(blob));
  }

  #[test]
  fn keys_by_prefix_counts_characters_not_bytes() {
    let c = mem();
    for k in ["meta:1", "meta:2", "file:1", "メタ:3", "メタ:4"] {
      set(&c, "lib", k, b"x").unwrap();
    }
    assert_eq!(keys(&c, "lib", "meta:").unwrap(), vec!["meta:1", "meta:2"]);
    assert_eq!(keys(&c, "lib", "メタ:").unwrap(), vec!["メタ:3", "メタ:4"]);
    assert_eq!(keys(&c, "other", "meta:").unwrap(), Vec::<String>::new());
  }
}

/// 经过真实的 IPC 通道(含原始字节请求体与请求头)测试命令,和前端的调用方式一致。
#[cfg(test)]
mod ipc_tests {
  use super::*;
  use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
  use tauri::webview::InvokeRequest;
  use tauri::{ipc::{CallbackFn, InvokeBody}, WebviewWindowBuilder};

  fn app() -> tauri::WebviewWindow<tauri::test::MockRuntime> {
    let app = mock_builder()
      .invoke_handler(tauri::generate_handler![kv_get_text, kv_set_text, kv_bytes_len, kv_bytes_get, kv_bytes_put, kv_del, kv_keys])
      .build(mock_context(noop_assets()))
      .unwrap();
    let conn = Connection::open_in_memory().unwrap();
    init(&conn).unwrap();
    app.manage(Db(Mutex::new(conn)));
    app.manage(Staging::default());
    WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap()
  }

  fn call(w: &tauri::WebviewWindow<tauri::test::MockRuntime>, cmd: &str, body: InvokeBody, headers: &[(&str, &str)]) -> Result<tauri::ipc::InvokeResponseBody, serde_json::Value> {
    let mut map = tauri::http::HeaderMap::new();
    for (k, v) in headers {
      map.insert(tauri::http::header::HeaderName::from_bytes(k.as_bytes()).unwrap(), v.parse().unwrap());
    }
    get_ipc_response(
      w,
      InvokeRequest {
        cmd: cmd.into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        // 本地页面的来源:Windows 与 Android 是 http://tauri.localhost,其余是 tauri://localhost
        url: if cfg!(any(windows, target_os = "android")) { "http://tauri.localhost" } else { "tauri://localhost" }.parse().unwrap(),
        body,
        headers: map,
        invoke_key: INVOKE_KEY.to_string(),
      },
    )
  }

  #[test]
  fn text_round_trip_over_ipc() {
    let w = app();
    let json = |v: serde_json::Value| InvokeBody::Json(v);
    let missing = call(&w, "kv_get_text", json(serde_json::json!({ "ns": "a", "key": "k" })), &[]).unwrap();
    assert_eq!(missing.deserialize::<Option<String>>().unwrap(), None);

    call(&w, "kv_set_text", json(serde_json::json!({ "ns": "a", "key": "k", "value": "{\"x\":1}" })), &[]).unwrap();
    let got = call(&w, "kv_get_text", json(serde_json::json!({ "ns": "a", "key": "k" })), &[]).unwrap();
    assert_eq!(got.deserialize::<Option<String>>().unwrap().as_deref(), Some("{\"x\":1}"));
  }

  fn put(w: &tauri::WebviewWindow<tauri::test::MockRuntime>, key: &str, offset: usize, chunk: &[u8], last: bool) -> Result<tauri::ipc::InvokeResponseBody, serde_json::Value> {
    call(
      w,
      "kv_bytes_put",
      InvokeBody::Json(serde_json::json!({ "ns": "library", "key": key, "offset": offset, "chunk": STANDARD.encode(chunk), "last": last })),
      &[],
    )
  }

  #[test]
  fn bytes_round_trip_in_chunks() {
    let w = app();
    let payload: Vec<u8> = (0..=255u8).cycle().take(1000).collect();
    // 键里有中文、竖线、空格,以及分三块上传
    let key = "file:书|a b";
    assert_eq!(call(&w, "kv_bytes_len", InvokeBody::Json(serde_json::json!({ "ns": "library", "key": key })), &[]).unwrap().deserialize::<Option<u64>>().unwrap(), None);

    put(&w, key, 0, &payload[..400], false).unwrap();
    put(&w, key, 400, &payload[400..900], false).unwrap();
    // 还没收完,数据库里不应该有
    assert_eq!(call(&w, "kv_bytes_len", InvokeBody::Json(serde_json::json!({ "ns": "library", "key": key })), &[]).unwrap().deserialize::<Option<u64>>().unwrap(), None);
    put(&w, key, 900, &payload[900..], true).unwrap();

    let len = call(&w, "kv_bytes_len", InvokeBody::Json(serde_json::json!({ "ns": "library", "key": key })), &[]).unwrap().deserialize::<Option<u64>>().unwrap();
    assert_eq!(len, Some(1000));

    let mut got = Vec::new();
    for offset in (0..1000).step_by(300) {
      let part = call(&w, "kv_bytes_get", InvokeBody::Json(serde_json::json!({ "ns": "library", "key": key, "offset": offset, "len": 300.min(1000 - offset) })), &[])
        .unwrap()
        .deserialize::<String>()
        .unwrap();
      got.extend(STANDARD.decode(part).unwrap());
    }
    assert_eq!(got, payload);
  }

  #[test]
  fn out_of_order_chunk_is_rejected_and_restart_works() {
    let w = app();
    put(&w, "k", 0, b"abc", false).unwrap();
    assert!(put(&w, "k", 5, b"zzz", true).is_err()); // 跳过了中间
    // 失败后暂存被清掉,可以从头重传
    put(&w, "k", 0, b"hello", true).unwrap();
    let part = call(&w, "kv_bytes_get", InvokeBody::Json(serde_json::json!({ "ns": "library", "key": "k", "offset": 0, "len": 5 })), &[]).unwrap().deserialize::<String>().unwrap();
    assert_eq!(STANDARD.decode(part).unwrap(), b"hello");
  }

  #[test]
  fn keys_and_delete_over_ipc() {
    let w = app();
    for k in ["meta:1", "meta:2", "file:1"] {
      call(&w, "kv_set_text", InvokeBody::Json(serde_json::json!({ "ns": "library", "key": k, "value": "1" })), &[]).unwrap();
    }
    let keys = call(&w, "kv_keys", InvokeBody::Json(serde_json::json!({ "ns": "library", "prefix": "meta:" })), &[]).unwrap();
    assert_eq!(keys.deserialize::<Vec<String>>().unwrap(), vec!["meta:1", "meta:2"]);

    call(&w, "kv_del", InvokeBody::Json(serde_json::json!({ "ns": "library", "keys": ["meta:1", "file:1"] })), &[]).unwrap();
    let keys = call(&w, "kv_keys", InvokeBody::Json(serde_json::json!({ "ns": "library", "prefix": "" })), &[]).unwrap();
    assert_eq!(keys.deserialize::<Vec<String>>().unwrap(), vec!["meta:2"]);
  }
}
