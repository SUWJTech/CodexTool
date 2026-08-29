use std::sync::mpsc::Sender;
use std::sync::Arc;
use std::thread::JoinHandle as ThreadJoinHandle;
use std::time::Instant;

use tokio::sync::Mutex;

use futures_util::future::BoxFuture;
use futures_util::future::Shared;

use crate::auth::PendingOauthLogin;
use crate::models::AccountSummary;

pub(crate) type UsageRefreshResult = Result<Vec<AccountSummary>, String>;

pub(crate) struct UsageRefreshFlight {
    pub(crate) id: u64,
    pub(crate) force_auth_refresh: bool,
    pub(crate) future: Shared<BoxFuture<'static, UsageRefreshResult>>,
}

#[derive(Clone)]
pub(crate) struct UsageRefreshSuccess {
    pub(crate) completed_at: Instant,
    pub(crate) force_auth_refresh: bool,
    pub(crate) summaries: Vec<AccountSummary>,
}

#[derive(Default)]
pub(crate) struct UsageRefreshCoordinator {
    pub(crate) next_id: u64,
    pub(crate) current: Option<UsageRefreshFlight>,
    pub(crate) last_successful: Option<UsageRefreshSuccess>,
}

pub(crate) struct OauthCallbackListenerHandle {
    pub(crate) shutdown_tx: Option<Sender<()>>,
    pub(crate) task: Option<ThreadJoinHandle<()>>,
}

/// 全局运行态：
/// - `store_lock` 保证账号存储读写的串行化。
/// - `auth_operation_lock` 串行化 login/import/switch/token-refresh 等会改写 auth 的操作。
/// - `pending_oauth_login` 维护当前 OAuth 授权会话。
/// - `oauth_listener` 维护本地 OAuth 回调监听线程。
pub(crate) struct AppState {
    pub(crate) store_lock: Arc<Mutex<()>>,
    pub(crate) auth_operation_lock: Arc<Mutex<()>>,
    pub(crate) usage_refresh: Mutex<UsageRefreshCoordinator>,
    pub(crate) usage_surface_error: std::sync::Mutex<Option<String>>,
    pub(crate) pending_oauth_login: Mutex<Option<PendingOauthLogin>>,
    pub(crate) oauth_listener: Mutex<Option<OauthCallbackListenerHandle>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            store_lock: Arc::new(Mutex::new(())),
            auth_operation_lock: Arc::new(Mutex::new(())),
            usage_refresh: Mutex::new(UsageRefreshCoordinator::default()),
            usage_surface_error: std::sync::Mutex::new(None),
            pending_oauth_login: Mutex::new(None),
            oauth_listener: Mutex::new(None),
        }
    }
}
