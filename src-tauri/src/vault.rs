use aes_gcm::aead::{Aead, Generate, Key, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use tokio::sync::OnceCell;

const SERVICE: &str = "Aurolis";
const ACCOUNT: &str = "data-key";
const PREFIX: &str = "v1:";
const NONCE_BYTES: usize = 12;

pub struct Vault {
    cipher: OnceCell<Option<Aes256Gcm>>,
    disabled: bool,
}

fn load_key() -> Option<Vec<u8>> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).ok()?;
    match entry.get_password() {
        Ok(encoded) => STANDARD
            .decode(encoded.trim())
            .ok()
            .filter(|key| key.len() == 32),
        Err(keyring::Error::NoEntry) => {
            let key = Key::<Aes256Gcm>::generate();
            entry.set_password(&STANDARD.encode(key.as_slice())).ok()?;
            Some(key.to_vec())
        }
        Err(_) => None,
    }
}

impl Vault {
    pub fn new() -> Self {
        Self {
            cipher: OnceCell::new(),
            disabled: std::env::var_os("AUROLIS_DISABLE_KEYCHAIN").is_some(),
        }
    }

    async fn cipher(&self) -> Option<&Aes256Gcm> {
        self.cipher
            .get_or_init(|| async {
                if self.disabled {
                    return None;
                }
                let key = tokio::task::spawn_blocking(load_key).await.ok()??;
                Aes256Gcm::new_from_slice(&key).ok()
            })
            .await
            .as_ref()
    }

    pub async fn available(&self) -> bool {
        self.cipher().await.is_some()
    }

    pub async fn seal(&self, plaintext: &[u8]) -> Option<String> {
        let cipher = self.cipher().await?;
        let nonce = Nonce::generate();
        let sealed = cipher.encrypt(&nonce, plaintext).ok()?;
        let mut bytes = nonce.to_vec();
        bytes.extend_from_slice(&sealed);
        Some(format!("{PREFIX}{}", STANDARD.encode(bytes)))
    }

    pub async fn open(&self, sealed: &str) -> Option<Vec<u8>> {
        let cipher = self.cipher().await?;
        let bytes = STANDARD.decode(sealed.trim().strip_prefix(PREFIX)?).ok()?;
        if bytes.len() <= NONCE_BYTES {
            return None;
        }
        let (nonce, body) = bytes.split_at(NONCE_BYTES);
        let nonce = Nonce::try_from(nonce).ok()?;
        cipher.decrypt(&nonce, body).ok()
    }
}
