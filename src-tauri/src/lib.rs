mod kv;

use keyring::{Entry, Error};

/// 钥匙串里的服务名,与应用标识一致。
const SERVICE: &str = "moe.nyaneko.kotonoha";

fn entry(name: &str) -> Result<Entry, String> {
  Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

/// 读取保存在系统钥匙串里的机密(如 API Key);不存在时返回 None。
#[tauri::command]
fn secret_get(name: String) -> Result<Option<String>, String> {
  match entry(&name)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
fn secret_set(name: String, value: String) -> Result<(), String> {
  entry(&name)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_delete(name: String) -> Result<(), String> {
  match entry(&name)?.delete_credential() {
    Ok(()) | Err(Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      secret_get,
      secret_set,
      secret_delete,
      kv::kv_get_text,
      kv::kv_set_text,
      kv::kv_bytes_len,
      kv::kv_bytes_get,
      kv::kv_bytes_put,
      kv::kv_del,
      kv::kv_keys
    ])
    .setup(|app| {
      kv::setup(app)?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn secret_round_trip() {
    let name = "test-round-trip".to_string();
    secret_delete(name.clone()).unwrap();
    assert_eq!(secret_get(name.clone()).unwrap(), None);

    secret_set(name.clone(), "sk-test-123".into()).unwrap();
    assert_eq!(secret_get(name.clone()).unwrap().as_deref(), Some("sk-test-123"));

    secret_set(name.clone(), "sk-test-456".into()).unwrap();
    assert_eq!(secret_get(name.clone()).unwrap().as_deref(), Some("sk-test-456"));

    secret_delete(name.clone()).unwrap();
    assert_eq!(secret_get(name).unwrap(), None);
  }
}
