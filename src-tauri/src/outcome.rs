use serde::Serialize;
use serde::ser::SerializeMap;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Failure {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_at: Option<i64>,
}

impl Failure {
    pub fn code(code: &str) -> Self {
        Self {
            code: code.to_string(),
            message: None,
            status: None,
            reset_at: None,
        }
    }

    pub fn new(code: &str, message: impl Into<String>) -> Self {
        let message = message.into();
        let message = (!message.is_empty() && message != code).then_some(message);
        Self {
            code: code.to_string(),
            message,
            status: None,
            reset_at: None,
        }
    }

    pub fn with_status(mut self, status: u16) -> Self {
        self.status = Some(status);
        self
    }

    pub fn is(&self, code: &str) -> bool {
        self.code == code
    }
}

impl From<std::io::Error> for Failure {
    fn from(error: std::io::Error) -> Self {
        Failure::new("unknown", error.to_string())
    }
}

pub type AppResult<T> = Result<T, Failure>;

pub struct Outcome<T>(pub AppResult<T>);

impl<T: Serialize> Serialize for Outcome<T> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(2))?;
        match &self.0 {
            Ok(data) => {
                map.serialize_entry("ok", &true)?;
                map.serialize_entry("data", data)?;
            }
            Err(error) => {
                map.serialize_entry("ok", &false)?;
                map.serialize_entry("error", error)?;
            }
        }
        map.end()
    }
}

impl<T> From<AppResult<T>> for Outcome<T> {
    fn from(result: AppResult<T>) -> Self {
        Outcome(result)
    }
}

pub fn invalid(message: impl Into<String>) -> Failure {
    Failure::new("invalid_input", message)
}
