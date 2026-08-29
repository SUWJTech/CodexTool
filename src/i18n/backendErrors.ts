import type { AppLocale } from "./catalog";

type PhraseMap = Record<AppLocale, string>;

type PhraseReplacement = {
  source: string;
  target: PhraseMap;
};

function phrases(
  zhCn: string,
  enUs: string,
  jaJp: string,
  koKr: string,
  ruRu: string,
): PhraseMap {
  return {
    "zh-CN": zhCn,
    "en-US": enUs,
    "ja-JP": jaJp,
    "ko-KR": koKr,
    "ru-RU": ruRu,
  };
}

const AUTH_EXPIRED_MESSAGE = phrases(
  "工具保存的授权快照已失效，请重新登录授权。",
  "The saved authorization snapshot is no longer valid. Please sign in again.",
  "保存された認証スナップショットが無効になりました。再度ログインして認可してください。",
  "저장된 인증 스냅샷이 더 이상 유효하지 않습니다. 다시 로그인하여 인증하세요.",
  "Сохраненный снимок авторизации больше недействителен. Войдите снова."
);

const DEACTIVATED_ACCOUNT_MESSAGE = phrases(
  "账号被封禁，请检查邮箱",
  "This account has been deactivated. Please check your email.",
  "このアカウントは停止されています。メールを確認してください。",
  "이 계정은 비활성화되었습니다. 이메일을 확인하세요.",
  "Этот аккаунт деактивирован. Проверьте электронную почту."
);

const REPLACEMENTS: PhraseReplacement[] = [
  {
    source: "账号被封禁，请检查邮箱",
    target: phrases(
      "账号被封禁，请检查邮箱",
      "This account has been deactivated. Please check your email.",
      "このアカウントは停止されています。メールを確認してください。",
      "이 계정은 비활성화되었습니다. 이메일을 확인하세요.",
      "Этот аккаунт деактивирован. Проверьте электронную почту."
    ),
  },
  {
    source: "授权过期，请重新登录授权。",
    target: AUTH_EXPIRED_MESSAGE,
  },
  {
    source: "工具保存的授权快照已失效，请重新登录授权。",
    target: phrases(
      "工具保存的授权快照已失效，请重新登录授权。",
      "The saved authorization snapshot is no longer valid. Please sign in again.",
      "保存された認証スナップショットが無効になりました。再度ログインして認可してください。",
      "저장된 인증 스냅샷이 더 이상 유효하지 않습니다. 다시 로그인하여 인증하세요.",
      "Сохраненный снимок авторизации больше недействителен. Войдите снова."
    ),
  },
  {
    source: "用量刷新失败：登录令牌已过期，请刷新用量或切换账号重新校验。",
    target: phrases(
      "用量刷新失败：登录令牌已过期，请刷新用量或切换账号重新校验。",
      "Usage refresh failed because the sign-in token expired. Refresh usage or switch accounts to check again.",
      "サインイントークンの期限が切れたため、使用量の更新に失敗しました。使用量を更新するか、アカウントを切り替えて再確認してください。",
      "로그인 토큰이 만료되어 사용량 새로고침에 실패했습니다. 사용량을 새로고침하거나 계정을 전환해 다시 확인하세요.",
      "Не удалось обновить использование: срок действия токена входа истек. Обновите использование или переключите аккаунт для повторной проверки."
    ),
  },
  {
    source: "当前账号不是 ChatGPT 登录模式，无法读取 Codex 5h/1week 用量。请先执行 codex login。",
    target: phrases(
      "当前账号不是 ChatGPT 登录模式，无法读取 Codex 5h/1week 用量。请先执行 codex login。",
      "The current account is not using ChatGPT sign-in mode, so Codex 5h/1week usage cannot be read. Run codex login first.",
      "現在のアカウントは ChatGPT ログインモードではないため、Codex 5h/1week の使用量を読み取れません。先に codex login を実行してください。",
      "현재 계정이 ChatGPT 로그인 모드가 아니어서 Codex 5h/1week 사용량을 읽을 수 없습니다. 먼저 codex login을 실행하세요.",
      "Текущий аккаунт не использует вход через ChatGPT, поэтому невозможно прочитать использование Codex 5h/1week. Сначала выполните codex login."
    ),
  },
  {
    source:
      "当前 auth.json 未包含 ChatGPT 登录令牌。若该文件来自新版 Codex（尤其是 macOS），令牌可能保存在系统钥匙串/安全存储中，因此不能仅靠这个 auth.json 跨机导入。请在目标设备执行 codex login，或提供包含 access_token / id_token / refresh_token 的完整 auth.json。",
    target: phrases(
      "当前 auth.json 未包含 ChatGPT 登录令牌。若该文件来自新版 Codex（尤其是 macOS），令牌可能保存在系统钥匙串/安全存储中，因此不能仅靠这个 auth.json 跨机导入。请在目标设备执行 codex login，或提供包含 access_token / id_token / refresh_token 的完整 auth.json。",
      "This auth.json does not contain ChatGPT sign-in tokens. If it came from a newer Codex install, especially on macOS, the tokens may live in the system keychain or secure storage, so this auth.json alone cannot be imported across devices. Run codex login on the target device, or provide a complete auth.json that includes access_token, id_token, and refresh_token.",
      "この auth.json には ChatGPT のログイントークンが含まれていません。新しい Codex 環境、特に macOS 由来のファイルでは、トークンがシステムのキーチェーンや安全なストレージに保存されている可能性があり、この auth.json だけでは別の端末へ移行できません。移行先の端末で codex login を実行するか、access_token / id_token / refresh_token を含む完全な auth.json を用意してください。",
      "이 auth.json에는 ChatGPT 로그인 토큰이 들어 있지 않습니다. 특히 macOS 의 최신 Codex 환경에서 가져온 파일이라면 토큰이 시스템 키체인이나 보안 저장소에 들어 있을 수 있어 이 auth.json 만으로는 다른 기기로 가져올 수 없습니다. 대상 기기에서 codex login 을 실행하거나 access_token / id_token / refresh_token 이 포함된 전체 auth.json 을 사용하세요.",
      "Этот auth.json не содержит токены входа ChatGPT. Если файл получен из новой установки Codex, особенно на macOS, токены могут храниться в системной связке ключей или защищенном хранилище, поэтому одного этого auth.json недостаточно для переноса на другое устройство. Выполните codex login на целевом устройстве или используйте полный auth.json с access_token, id_token и refresh_token."
    ),
  },
  {
    source: "未找到 codex 可执行文件。请先安装 Codex CLI，或将其所在目录加入系统 PATH。",
    target: phrases(
      "未找到 codex 可执行文件。请先安装 Codex CLI，或将其所在目录加入系统 PATH。",
      "The codex executable was not found. Install Codex CLI first, or add its directory to PATH.",
      "codex 実行ファイルが見つかりません。先に Codex CLI をインストールするか、そのディレクトリを PATH に追加してください。",
      "codex 실행 파일을 찾을 수 없습니다. 먼저 Codex CLI를 설치하거나 해당 디렉터리를 PATH에 추가하세요.",
      "Исполняемый файл codex не найден. Сначала установите Codex CLI или добавьте его каталог в PATH."
    ),
  },
  {
    source: "设置的 Codex 启动路径无效。请填写 Codex.exe 或 codex/codex.exe 的完整路径，或填写包含它们的安装目录。",
    target: phrases(
      "设置的 Codex 启动路径无效。请填写 Codex.exe 或 codex/codex.exe 的完整路径，或填写包含它们的安装目录。",
      "The configured Codex launch path is invalid. Enter the full path to Codex.exe or codex/codex.exe, or an install directory that contains them.",
      "設定した Codex 起動パスが無効です。Codex.exe または codex/codex.exe のフルパス、またはそれらを含むインストールディレクトリを入力してください。",
      "설정한 Codex 실행 경로가 올바르지 않습니다. Codex.exe 또는 codex/codex.exe의 전체 경로나 해당 파일이 들어 있는 설치 디렉터리를 입력하세요.",
      "Указанный путь запуска Codex недействителен. Введите полный путь к Codex.exe или codex/codex.exe либо каталог установки, где они находятся."
    ),
  },
  {
    source: "本次尝试的 ",
    target: phrases(
      "本次尝试的 ",
      "This attempt tried ",
      "今回の試行では ",
      "이번 시도에서는 ",
      "В этой попытке было использовано "
    ),
  },
  {
    source: " 个账号全部被上游拒绝",
    target: phrases(
      " 个账号全部被上游拒绝",
      " accounts, and all of them were rejected by the upstream",
      " 件のアカウントがすべて上流に拒否されました",
      "개의 계정이 모두 업스트림에 의해 거부되었습니다",
      " аккаунтов, и все они были отклонены upstream"
    ),
  },
  {
    source: "读取账号存储文件失败",
    target: phrases(
      "读取账号存储文件失败",
      "Failed to read account storage file",
      "アカウント保存ファイルの読み込みに失敗しました",
      "계정 저장 파일을 읽지 못했습니다",
      "Не удалось прочитать файл хранилища аккаунтов"
    ),
  },
  {
    source: "账号存储文件格式无效且修复失败",
    target: phrases(
      "账号存储文件格式无效且修复失败",
      "The account storage file is invalid and repair failed",
      "アカウント保存ファイルの形式が不正で、修復にも失敗しました",
      "계정 저장 파일 형식이 잘못되었고 복구에도 실패했습니다",
      "Файл хранилища аккаунтов имеет неверный формат, и восстановление не удалось"
    ),
  },
  {
    source: "账号存储文件格式无效，已重建默认存储",
    target: phrases(
      "账号存储文件格式无效，已重建默认存储",
      "The account storage file is invalid. A default store has been rebuilt",
      "アカウント保存ファイルの形式が不正なため、既定の保存内容を再作成しました",
      "계정 저장 파일 형식이 잘못되어 기본 저장소로 다시 만들었습니다",
      "Файл хранилища аккаунтов имеет неверный формат. Хранилище по умолчанию было пересоздано"
    ),
  },
  {
    source: "请至少提供一个 JSON 文件或 JSON 文本",
    target: phrases(
      "请至少提供一个 JSON 文件或 JSON 文本",
      "Provide at least one JSON file or JSON text",
      "少なくとも 1 つの JSON ファイルまたは JSON テキストを指定してください",
      "JSON 파일 또는 JSON 텍스트를 하나 이상 제공하세요",
      "Укажите хотя бы один JSON-файл или JSON-текст"
    ),
  },
  {
    source: "JSON 内容为空",
    target: phrases(
      "JSON 内容为空",
      "The JSON content is empty",
      "JSON の内容が空です",
      "JSON 내용이 비어 있습니다",
      "Содержимое JSON пусто"
    ),
  },
  {
    source: "JSON 格式无效",
    target: phrases(
      "JSON 格式无效",
      "Invalid JSON format",
      "JSON の形式が不正です",
      "JSON 형식이 올바르지 않습니다",
      "Неверный формат JSON"
    ),
  },
  {
    source: "未找到要删除的账号",
    target: phrases(
      "未找到要删除的账号",
      "The account to delete was not found",
      "削除対象のアカウントが見つかりません",
      "삭제할 계정을 찾을 수 없습니다",
      "Не удалось найти аккаунт для удаления"
    ),
  },
  {
    source: "令牌刷新失败",
    target: phrases(
      "令牌刷新失败",
      "Token refresh failed",
      "トークンの更新に失敗しました",
      "토큰 새로고침에 실패했습니다",
      "Не удалось обновить токен"
    ),
  },
  {
    source: "创建 HTTP 客户端失败",
    target: phrases(
      "创建 HTTP 客户端失败",
      "Failed to create HTTP client",
      "HTTP クライアントの作成に失敗しました",
      "HTTP 클라이언트를 생성하지 못했습니다",
      "Не удалось создать HTTP-клиент"
    ),
  },
  {
    source: "请求用量接口失败",
    target: phrases(
      "请求用量接口失败",
      "Usage API request failed",
      "使用量 API のリクエストに失敗しました",
      "사용량 API 요청에 실패했습니다",
      "Не удалось выполнить запрос к API использования"
    ),
  },
  {
    source: "未命中任何候选地址",
    target: phrases(
      "未命中任何候选地址",
      "No candidate endpoint succeeded",
      "候補エンドポイントのいずれも成功しませんでした",
      "후보 엔드포인트 중 성공한 것이 없습니다",
      "Ни одна из кандидатных конечных точек не сработала"
    ),
  },
  {
    source: "解析返回失败",
    target: phrases(
      "解析返回失败",
      "Failed to parse response",
      "レスポンスの解析に失敗しました",
      "응답을 파싱하지 못했습니다",
      "Не удалось разобрать ответ"
    ),
  },
  {
    source: "仅允许打开 http/https 链接",
    target: phrases(
      "仅允许打开 http/https 链接",
      "Only http/https links can be opened",
      "開けるのは http/https リンクのみです",
      "http/https 링크만 열 수 있습니다",
      "Можно открывать только ссылки http/https"
    ),
  },
  {
    source: "打开外部链接失败",
    target: phrases(
      "打开外部链接失败",
      "Failed to open external link",
      "外部リンクを開けませんでした",
      "외부 링크를 열지 못했습니다",
      "Не удалось открыть внешнюю ссылку"
    ),
  },
  {
    source: "无法启动 codex login",
    target: phrases(
      "无法启动 codex login",
      "Failed to start codex login",
      "codex login を開始できませんでした",
      "codex login을 시작하지 못했습니다",
      "Не удалось запустить codex login"
    ),
  },
  {
    source: "找不到要切换的账号",
    target: phrases(
      "找不到要切换的账号",
      "The account to switch to was not found",
      "切り替え先のアカウントが見つかりません",
      "전환할 계정을 찾을 수 없습니다",
      "Не удалось найти аккаунт для переключения"
    ),
  },
  {
    source: "未检测到 opencode 安装位置或认证文件",
    target: phrases(
      "未检测到 opencode 安装位置或认证文件",
      "The opencode installation path or auth file was not detected",
      "opencode のインストール先または認証ファイルが見つかりません",
      "opencode 설치 경로나 인증 파일을 찾을 수 없습니다",
      "Путь установки opencode или файл авторизации не обнаружен"
    ),
  },
  {
    source: "未能定位 opencode 认证文件路径",
    target: phrases(
      "未能定位 opencode 认证文件路径",
      "Failed to locate the opencode auth file path",
      "opencode 認証ファイルのパスを特定できませんでした",
      "opencode 인증 파일 경로를 찾지 못했습니다",
      "Не удалось определить путь к auth-файлу opencode"
    ),
  },
  {
    source: "未检测到 opencode 桌面端应用",
    target: phrases(
      "未检测到 opencode 桌面端应用",
      "The Opencode desktop app was not detected",
      "Opencode デスクトップアプリが見つかりません",
      "Opencode 데스크톱 앱을 찾을 수 없습니다",
      "Приложение Opencode Desktop не обнаружено"
    ),
  },
  {
    source: "opencode 桌面端重启失败",
    target: phrases(
      "opencode 桌面端重启失败",
      "Opencode desktop restart failed",
      "Opencode デスクトップの再起動に失敗しました",
      "Opencode 데스크톱 재시작에 실패했습니다",
      "Не удалось перезапустить Opencode Desktop"
    ),
  },
  {
    source: "当前平台暂不支持重启 opencode 桌面端",
    target: phrases(
      "当前平台暂不支持重启 opencode 桌面端",
      "Restarting Opencode desktop is not supported on this platform",
      "このプラットフォームでは Opencode デスクトップの再起動はサポートされていません",
      "현재 플랫폼에서는 Opencode 데스크톱 재시작을 지원하지 않습니다",
      "На этой платформе перезапуск Opencode Desktop не поддерживается"
    ),
  },
  {
    source: "Opencode OpenAI 认证已同步到",
    target: phrases(
      "Opencode OpenAI 认证已同步到",
      "Opencode OpenAI credentials were synced to",
      "Opencode OpenAI 認証を次へ同期しました",
      "Opencode OpenAI 인증이 다음 위치로 동기화되었습니다",
      "Учетные данные OpenAI для Opencode были синхронизированы в"
    ),
  },
  {
    source: "未选择重启目标编辑器",
    target: phrases(
      "未选择重启目标编辑器",
      "No editor was selected for restart",
      "再起動対象のエディタが選択されていません",
      "재시작할 편집기가 선택되지 않았습니다",
      "Не выбран редактор для перезапуска"
    ),
  },
  {
    source: "未找到微软商店版 Codex 的启动标识（AUMID）。",
    target: phrases(
      "未找到微软商店版 Codex 的启动标识（AUMID）。",
      "Unable to find the launch identifier (AUMID) for the Microsoft Store version of Codex.",
      "Microsoft Store 版 Codex の起動識別子 (AUMID) が見つかりません。",
      "Microsoft Store 버전 Codex 의 시작 식별자(AUMID)를 찾을 수 없습니다.",
      "Не удалось найти идентификатор запуска (AUMID) для версии Codex из Microsoft Store."
    ),
  },
  {
    source: "微软商店版 Codex 激活后未检测到进程启动",
    target: phrases(
      "微软商店版 Codex 激活后未检测到进程启动",
      "No Codex process was detected after activating the Microsoft Store version",
      "Microsoft Store 版 Codex を有効化した後もプロセスの起動を検出できませんでした",
      "Microsoft Store 버전 Codex 를 활성화한 뒤에도 프로세스 시작을 감지하지 못했습니다",
      "После активации версии Codex из Microsoft Store запуск процесса не был обнаружен"
    ),
  },
  {
    source: "创建微软商店激活管理器失败",
    target: phrases(
      "创建微软商店激活管理器失败",
      "Failed to create the Microsoft Store activation manager",
      "Microsoft Store のアクティベーションマネージャーを作成できませんでした",
      "Microsoft Store 활성화 관리자를 만들지 못했습니다",
      "Не удалось создать диспетчер активации Microsoft Store"
    ),
  },
  {
    source: "通过 AUMID 激活 Codex 失败",
    target: phrases(
      "通过 AUMID 激活 Codex 失败",
      "Failed to activate Codex via AUMID",
      "AUMID 経由で Codex を起動できませんでした",
      "AUMID 를 통해 Codex 를 활성화하지 못했습니다",
      "Не удалось активировать Codex через AUMID"
    ),
  },
  {
    source: "初始化 Windows COM 失败",
    target: phrases(
      "初始化 Windows COM 失败",
      "Failed to initialize Windows COM",
      "Windows COM の初期化に失敗しました",
      "Windows COM 초기화에 실패했습니다",
      "Не удалось инициализировать Windows COM"
    ),
  },
  {
    source: "未知编辑器标识",
    target: phrases(
      "未知编辑器标识",
      "Unknown editor identifier",
      "不明なエディタ識別子",
      "알 수 없는 편집기 식별자",
      "Неизвестный идентификатор редактора"
    ),
  },
  {
    source: "未检测到安装路径",
    target: phrases(
      "未检测到安装路径",
      "Installation path was not detected",
      "インストールパスが見つかりません",
      "설치 경로를 찾을 수 없습니다",
      "Путь установки не обнаружен"
    ),
  },
  {
    source: "重启应用失败",
    target: phrases(
      "重启应用失败",
      "Failed to restart the application",
      "アプリの再起動に失敗しました",
      "앱을 다시 시작하지 못했습니다",
      "Не удалось перезапустить приложение"
    ),
  },
  {
    source: "open 命令返回非零状态",
    target: phrases(
      "open 命令返回非零状态",
      "The open command exited with a non-zero status",
      "open コマンドが非ゼロステータスを返しました",
      "open 명령이 0이 아닌 상태로 종료되었습니다",
      "Команда open завершилась с ненулевым статусом"
    ),
  },
  {
    source: "当前平台暂不支持编辑器自动重启",
    target: phrases(
      "当前平台暂不支持编辑器自动重启",
      "Automatic editor restart is not supported on the current platform",
      "現在のプラットフォームではエディタの自動再起動はサポートされていません",
      "현재 플랫폼에서는 편집기 자동 재시작을 지원하지 않습니다",
      "Автоматический перезапуск редактора не поддерживается на текущей платформе"
    ),
  },
  {
    source: "启动 Codex 应用失败",
    target: phrases(
      "启动 Codex 应用失败",
      "Failed to launch the Codex app",
      "Codex アプリの起動に失敗しました",
      "Codex 앱을 시작하지 못했습니다",
      "Не удалось запустить приложение Codex"
    ),
  },
  {
    source: "未检测到本地 Codex 应用，且通过 codex app 启动失败",
    target: phrases(
      "未检测到本地 Codex 应用，且通过 codex app 启动失败",
      "The local Codex app was not detected, and launching via codex app also failed",
      "ローカルの Codex アプリが見つからず、codex app 経由の起動にも失敗しました",
      "로컬 Codex 앱을 찾지 못했고 codex app으로 시작하는 데도 실패했습니다",
      "Локальное приложение Codex не обнаружено, и запуск через codex app тоже завершился неудачно"
    ),
  },
  {
    source: " 可能已被占用",
    target: phrases(
      " 可能已被占用",
      " may already be in use",
      " は既に使用中の可能性があります",
      " 가 이미 사용 중일 수 있습니다",
      " может быть уже занят"
    ),
  },
  {
    source: "读取 Codex 上游响应失败",
    target: phrases(
      "读取 Codex 上游响应失败",
      "Failed to read the Codex upstream response",
      "Codex 上流レスポンスの読み取りに失敗しました",
      "Codex 업스트림 응답을 읽지 못했습니다",
      "Не удалось прочитать ответ upstream Codex"
    ),
  },
  {
    source: "序列化聊天响应失败",
    target: phrases(
      "序列化聊天响应失败",
      "Failed to serialize chat response",
      "チャット応答のシリアライズに失敗しました",
      "채팅 응답을 직렬화하지 못했습니다",
      "Не удалось сериализовать ответ чата"
    ),
  },
  {
    source: "序列化 responses 响应失败",
    target: phrases(
      "序列化 responses 响应失败",
      "Failed to serialize responses output",
      "responses 応答のシリアライズに失敗しました",
      "responses 응답을 직렬화하지 못했습니다",
      "Не удалось сериализовать ответ responses"
    ),
  },
  {
    source: "请求体不是合法 JSON",
    target: phrases(
      "请求体不是合法 JSON",
      "The request body is not valid JSON",
      "リクエストボディが有効な JSON ではありません",
      "요청 본문이 유효한 JSON이 아닙니다",
      "Тело запроса не является корректным JSON"
    ),
  },
  {
    source: "聊天请求必须是 JSON 对象",
    target: phrases(
      "聊天请求必须是 JSON 对象",
      "The chat request must be a JSON object",
      "チャットリクエストは JSON オブジェクトである必要があります",
      "채팅 요청은 JSON 객체여야 합니다",
      "Запрос chat должен быть JSON-объектом"
    ),
  },
  {
    source: "聊天请求缺少 messages 数组",
    target: phrases(
      "聊天请求缺少 messages 数组",
      "The chat request is missing the messages array",
      "チャットリクエストに messages 配列がありません",
      "채팅 요청에 messages 배열이 없습니다",
      "В запросе chat отсутствует массив messages"
    ),
  },
  {
    source: "messages 数组中的每一项都必须是对象",
    target: phrases(
      "messages 数组中的每一项都必须是对象",
      "Each item in the messages array must be an object",
      "messages 配列の各項目はオブジェクトである必要があります",
      "messages 배열의 각 항목은 객체여야 합니다",
      "Каждый элемент массива messages должен быть объектом"
    ),
  },
  {
    source: "responses 请求必须是 JSON 对象",
    target: phrases(
      "responses 请求必须是 JSON 对象",
      "The responses request must be a JSON object",
      "responses リクエストは JSON オブジェクトである必要があります",
      "responses 요청은 JSON 객체여야 합니다",
      "Запрос responses должен быть JSON-объектом"
    ),
  },
  {
    source: "缺少必填字段 ",
    target: phrases(
      "缺少必填字段 ",
      "Missing required field ",
      "必須フィールドがありません ",
      "필수 필드가 없습니다 ",
      "Отсутствует обязательное поле "
    ),
  },
  {
    source: "序列化上游请求失败",
    target: phrases(
      "序列化上游请求失败",
      "Failed to serialize upstream request",
      "上流リクエストのシリアライズに失敗しました",
      "업스트림 요청을 직렬화하지 못했습니다",
      "Не удалось сериализовать upstream-запрос"
    ),
  },
  {
    source: "请求 Codex 上游失败 ",
    target: phrases(
      "请求 Codex 上游失败 ",
      "Codex upstream request failed ",
      "Codex 上流へのリクエストに失敗しました ",
      "Codex 업스트림 요청에 실패했습니다 ",
      "Запрос к upstream Codex завершился ошибкой "
    ),
  },
  {
    source: "刷新后解析账号登录态失败",
    target: phrases(
      "刷新后解析账号登录态失败",
      "Failed to parse the refreshed account sign-in state",
      "更新後のアカウントログイン状態の解析に失敗しました",
      "새로고침 후 계정 로그인 상태를 파싱하지 못했습니다",
      "Не удалось разобрать обновленное состояние входа аккаунта"
    ),
  },
  {
    source: "读取 API Key 存储失败",
    target: phrases(
      "读取 API Key 存储失败",
      "Failed to read API key storage",
      "API キー保存内容の読み取りに失敗しました",
      "API 키 저장소를 읽지 못했습니다",
      "Не удалось прочитать хранилище API-ключа"
    ),
  },
  {
    source: "无法获取应用数据目录",
    target: phrases(
      "无法获取应用数据目录",
      "Failed to resolve the app data directory",
      "アプリデータディレクトリを取得できませんでした",
      "앱 데이터 디렉터리를 가져오지 못했습니다",
      "Не удалось получить каталог данных приложения"
    ),
  },
  {
    source: "无法解析 API Key 存储目录",
    target: phrases(
      "无法解析 API Key 存储目录",
      "Failed to resolve the API key storage directory",
      "API キー保存ディレクトリを解決できませんでした",
      "API 키 저장 디렉터리를 해석하지 못했습니다",
      "Не удалось определить каталог хранения API-ключа"
    ),
  },
  {
    source: "创建 API Key 存储目录失败",
    target: phrases(
      "创建 API Key 存储目录失败",
      "Failed to create the API key storage directory",
      "API キー保存ディレクトリの作成に失敗しました",
      "API 키 저장 디렉터리를 생성하지 못했습니다",
      "Не удалось создать каталог хранения API-ключа"
    ),
  },
  {
    source: "创建 API Key 临时文件失败",
    target: phrases(
      "创建 API Key 临时文件失败",
      "Failed to create the temporary API key file",
      "API キー一時ファイルの作成に失敗しました",
      "API 키 임시 파일을 생성하지 못했습니다",
      "Не удалось создать временный файл API-ключа"
    ),
  },
  {
    source: "写入 API Key 临时文件失败",
    target: phrases(
      "写入 API Key 临时文件失败",
      "Failed to write the temporary API key file",
      "API キー一時ファイルへの書き込みに失敗しました",
      "API 키 임시 파일에 쓰지 못했습니다",
      "Не удалось записать временный файл API-ключа"
    ),
  },
  {
    source: "刷新 API Key 临时文件失败",
    target: phrases(
      "刷新 API Key 临时文件失败",
      "Failed to flush the temporary API key file",
      "API キー一時ファイルのフラッシュに失敗しました",
      "API 키 임시 파일을 flush하지 못했습니다",
      "Не удалось сбросить временный файл API-ключа"
    ),
  },
  {
    source: "替换 API Key 存储文件失败",
    target: phrases(
      "替换 API Key 存储文件失败",
      "Failed to replace the API key storage file",
      "API キー保存ファイルの置き換えに失敗しました",
      "API 키 저장 파일을 교체하지 못했습니다",
      "Не удалось заменить файл хранения API-ключа"
    ),
  },
  {
    source: "打开 API Key 存储目录失败",
    target: phrases(
      "打开 API Key 存储目录失败",
      "Failed to open the API key storage directory",
      "API キー保存ディレクトリを開けませんでした",
      "API 키 저장 디렉터리를 열지 못했습니다",
      "Не удалось открыть каталог хранения API-ключа"
    ),
  },
  {
    source: "刷新 API Key 存储目录失败",
    target: phrases(
      "刷新 API Key 存储目录失败",
      "Failed to flush the API key storage directory",
      "API キー保存ディレクトリのフラッシュに失敗しました",
      "API 키 저장 디렉터리를 flush하지 못했습니다",
      "Не удалось сбросить каталог хранения API-ключа"
    ),
  },
  {
    source: "移除旧 API Key 存储文件失败",
    target: phrases(
      "移除旧 API Key 存储文件失败",
      "Failed to remove the old API key storage file",
      "古い API キー保存ファイルの削除に失敗しました",
      "이전 API 키 저장 파일을 삭제하지 못했습니다",
      "Не удалось удалить старый файл хранения API-ключа"
    ),
  },
  {
    source: "上游流式响应中断",
    target: phrases(
      "上游流式响应中断",
      "The upstream streaming response was interrupted",
      "上流のストリーミング応答が中断されました",
      "업스트림 스트리밍 응답이 중단되었습니다",
      "Потоковый ответ upstream был прерван"
    ),
  },
  {
    source: "构建聊天流式响应失败",
    target: phrases(
      "构建聊天流式响应失败",
      "Failed to build chat streaming response",
      "チャットのストリーミング応答構築に失敗しました",
      "채팅 스트리밍 응답을 구성하지 못했습니다",
      "Не удалось сформировать потоковый ответ чата"
    ),
  },
  {
    source: "Codex 响应缺少 response 字段",
    target: phrases(
      "Codex 响应缺少 response 字段",
      "The Codex response is missing the response field",
      "Codex 応答に response フィールドがありません",
      "Codex 응답에 response 필드가 없습니다",
      "В ответе Codex отсутствует поле response"
    ),
  },
  {
    source: "未在 Codex SSE 中找到 response.completed 事件",
    target: phrases(
      "未在 Codex SSE 中找到 response.completed 事件",
      "response.completed was not found in the Codex SSE stream",
      "Codex SSE 内に response.completed イベントが見つかりませんでした",
      "Codex SSE에서 response.completed 이벤트를 찾지 못했습니다",
      "Событие response.completed не найдено в потоке Codex SSE"
    ),
  },
  {
    source: "额度用完",
    target: phrases("额度用完", "Quota exhausted", "クォータ不足", "할당량 소진", "Квота исчерпана"),
  },
  {
    source: "模型受限",
    target: phrases("模型受限", "Model restricted", "モデル制限", "모델 제한", "Ограничение модели"),
  },
  {
    source: "频率限制",
    target: phrases("频率限制", "Rate limited", "レート制限", "속도 제한", "Ограничение частоты"),
  },
  {
    source: "鉴权失败",
    target: phrases("鉴权失败", "Authentication failed", "認証失敗", "인증 실패", "Ошибка аутентификации"),
  },
  {
    source: "权限不足",
    target: phrases("权限不足", "Insufficient permissions", "権限不足", "권한 부족", "Недостаточно прав"),
  },
  {
    source: "未返回具体错误信息",
    target: phrases(
      "未返回具体错误信息",
      "No detailed error information was returned",
      "詳細なエラー情報は返されませんでした",
      "상세한 오류 정보가 반환되지 않았습니다",
      "Подробная информация об ошибке не была возвращена"
    ),
  },
  {
    source: "示例",
    target: phrases("示例", "Example", "例", "예시", "Пример"),
  },
  {
    source: "命名隧道需要填写 Cloudflare API Token、Account ID、Zone ID 和自定义域名。",
    target: phrases(
      "命名隧道需要填写 Cloudflare API Token、Account ID、Zone ID 和自定义域名。",
      "A named tunnel requires Cloudflare API Token, Account ID, Zone ID, and a custom domain.",
      "命名トンネルには Cloudflare API Token、Account ID、Zone ID、カスタムドメインが必要です。",
      "이름 있는 터널에는 Cloudflare API Token, Account ID, Zone ID, 사용자 지정 도메인이 필요합니다.",
      "Для именованного туннеля требуются Cloudflare API Token, Account ID, Zone ID и собственный домен."
    ),
  },
  {
    source: "命名隧道的所有字段都必须填写。",
    target: phrases(
      "命名隧道的所有字段都必须填写。",
      "All named tunnel fields are required.",
      "命名トンネルの全フィールドが必須です。",
      "이름 있는 터널의 모든 필드는 필수입니다.",
      "Все поля именованного туннеля обязательны."
    ),
  },
  {
    source: "自定义域名格式无效，请填写完整 Hostname，例如 api.example.com。",
    target: phrases(
      "自定义域名格式无效，请填写完整 Hostname，例如 api.example.com。",
      "The custom domain format is invalid. Enter a full hostname, for example api.example.com.",
      "カスタムドメインの形式が不正です。api.example.com のような完全なホスト名を入力してください。",
      "사용자 지정 도메인 형식이 잘못되었습니다. api.example.com 같은 전체 호스트 이름을 입력하세요.",
      "Неверный формат пользовательского домена. Укажите полный hostname, например api.example.com."
    ),
  },
  {
    source: "启动 Quick Tunnel 失败",
    target: phrases(
      "启动 Quick Tunnel 失败",
      "Failed to start Quick Tunnel",
      "Quick Tunnel の起動に失敗しました",
      "Quick Tunnel을 시작하지 못했습니다",
      "Не удалось запустить Quick Tunnel"
    ),
  },
  {
    source: "启动命名隧道失败",
    target: phrases(
      "启动命名隧道失败",
      "Failed to start named tunnel",
      "命名トンネルの起動に失敗しました",
      "이름 있는 터널을 시작하지 못했습니다",
      "Не удалось запустить именованный туннель"
    ),
  },
  {
    source: "创建命名隧道失败",
    target: phrases(
      "创建命名隧道失败",
      "Failed to create named tunnel",
      "命名トンネルの作成に失敗しました",
      "이름 있는 터널을 생성하지 못했습니다",
      "Не удалось создать именованный туннель"
    ),
  },
  {
    source: "写入命名隧道配置失败",
    target: phrases(
      "写入命名隧道配置失败",
      "Failed to write named tunnel configuration",
      "命名トンネル設定の書き込みに失敗しました",
      "이름 있는 터널 구성을 쓰지 못했습니다",
      "Не удалось записать конфигурацию именованного туннеля"
    ),
  },
  {
    source: "查询 DNS 记录失败",
    target: phrases(
      "查询 DNS 记录失败",
      "Failed to query DNS records",
      "DNS レコードの取得に失敗しました",
      "DNS 레코리를 조회하지 못했습니다",
      "Не удалось получить DNS-записи"
    ),
  },
  {
    source: "更新 DNS 记录失败",
    target: phrases(
      "更新 DNS 记录失败",
      "Failed to update DNS record",
      "DNS レコードの更新に失敗しました",
      "DNS 레코드를 업데이트하지 못했습니다",
      "Не удалось обновить DNS-запись"
    ),
  },
  {
    source: "创建 DNS 记录失败",
    target: phrases(
      "创建 DNS 记录失败",
      "Failed to create DNS record",
      "DNS レコードの作成に失敗しました",
      "DNS 레코드를 생성하지 못했습니다",
      "Не удалось создать DNS-запись"
    ),
  },
  {
    source: "清理命名隧道失败",
    target: phrases(
      "清理命名隧道失败",
      "Failed to clean up named tunnel",
      "命名トンネルのクリーンアップに失敗しました",
      "이름 있는 터널 정리에 실패했습니다",
      "Не удалось очистить именованный туннель"
    ),
  },
  {
    source: "Cloudflare 返回结果为空",
    target: phrases(
      "Cloudflare 返回结果为空",
      "Cloudflare returned an empty result",
      "Cloudflare から空の結果が返されました",
      "Cloudflare가 빈 결과를 반환했습니다",
      "Cloudflare вернул пустой результат"
    ),
  },
  {
    source: "未知错误",
    target: phrases("未知错误", "Unknown error", "不明なエラー", "알 수 없는 오류", "Неизвестная ошибка"),
  },
  {
    source: "命令返回了非零状态",
    target: phrases(
      "命令返回了非零状态",
      "The command exited with a non-zero status",
      "コマンドが非ゼロステータスで終了しました",
      "명령이 0이 아닌 상태로 종료되었습니다",
      "Команда завершилась с ненулевым статусом"
    ),
  },
  {
    source: "auth.json 缺少 access_token",
    target: phrases(
      "auth.json 缺少 access_token",
      "auth.json is missing access_token",
      "auth.json に access_token がありません",
      "auth.json에 access_token이 없습니다",
      "В auth.json отсутствует access_token"
    ),
  },
  {
    source: "auth.json 缺少 id_token",
    target: phrases(
      "auth.json 缺少 id_token",
      "auth.json is missing id_token",
      "auth.json に id_token がありません",
      "auth.json에 id_token이 없습니다",
      "В auth.json отсутствует id_token"
    ),
  },
  {
    source:
      "当前会话数据不包含 refresh_token，无法生成可持续使用的 Codex 登录态。请改用 OAuth 登录或导入完整 auth.json。",
    target: phrases(
      "当前会话数据不包含 refresh_token，无法生成可持续使用的 Codex 登录态。请改用 OAuth 登录或导入完整 auth.json。",
      "This session data has no refresh_token, so it cannot create a durable Codex sign-in. Use OAuth or import a complete auth.json instead.",
      "このセッションデータには refresh_token がないため、継続利用できる Codex ログインを作成できません。OAuth を使用するか、完全な auth.json をインポートしてください。",
      "이 세션 데이터에는 refresh_token이 없어 지속 가능한 Codex 로그인 상태를 만들 수 없습니다. OAuth를 사용하거나 완전한 auth.json을 가져오세요.",
      "В данных сеанса нет refresh_token, поэтому создать устойчивый вход Codex невозможно. Используйте OAuth или импортируйте полный auth.json."
    ),
  },
  {
    source: "auth.json 缺少 refresh_token",
    target: phrases(
      "auth.json 缺少 refresh_token",
      "auth.json is missing refresh_token",
      "auth.json に refresh_token がありません",
      "auth.json에 refresh_token이 없습니다",
      "В auth.json отсутствует refresh_token"
    ),
  },
  {
    source: "auth.json 缺少 tokens",
    target: phrases(
      "auth.json 缺少 tokens",
      "auth.json is missing tokens",
      "auth.json に tokens がありません",
      "auth.json에 tokens가 없습니다",
      "В auth.json отсутствует tokens"
    ),
  },
  {
    source: "无法从 auth.json 识别 chatgpt_account_id",
    target: phrases(
      "无法从 auth.json 识别 chatgpt_account_id",
      "Failed to read chatgpt_account_id from auth.json",
      "auth.json から chatgpt_account_id を識別できませんでした",
      "auth.json에서 chatgpt_account_id를 식별하지 못했습니다",
      "Не удалось определить chatgpt_account_id из auth.json"
    ),
  },
  {
    source: "当前 Codex 认证文件不是合法 JSON",
    target: phrases(
      "当前 Codex 认证文件不是合法 JSON",
      "The current Codex auth file is not valid JSON",
      "現在の Codex 認証ファイルは有効な JSON ではありません",
      "현재 Codex 인증 파일이 유효한 JSON이 아닙니다",
      "Текущий файл авторизации Codex не является корректным JSON"
    ),
  },
  {
    source: "读取当前 Codex 认证文件失败",
    target: phrases(
      "读取当前 Codex 认证文件失败",
      "Failed to read the current Codex auth file",
      "現在の Codex 認証ファイルの読み取りに失敗しました",
      "현재 Codex 인증 파일을 읽지 못했습니다",
      "Не удалось прочитать текущий файл авторизации Codex"
    ),
  },
  {
    source: "刷新登录令牌失败",
    target: phrases(
      "刷新登录令牌失败",
      "Failed to refresh sign-in token",
      "ログイントークンの更新に失敗しました",
      "로그인 토큰을 새로고침하지 못했습니다",
      "Не удалось обновить токен входа"
    ),
  },
  {
    source: "解析刷新令牌响应失败",
    target: phrases(
      "解析刷新令牌响应失败",
      "Failed to parse token refresh response",
      "トークン更新レスポンスの解析に失敗しました",
      "토큰 새로고침 응답을 파싱하지 못했습니다",
      "Не удалось разобрать ответ обновления токена"
    ),
  },
  {
    source: "auth.json 结构异常（根节点不是对象）",
    target: phrases(
      "auth.json 结构异常（根节点不是对象）",
      "auth.json has an invalid structure (root node is not an object)",
      "auth.json の構造が不正です（ルートノードがオブジェクトではありません）",
      "auth.json 구조가 올바르지 않습니다(루트 노드가 객체가 아님)",
      "Некорректная структура auth.json (корневой узел не является объектом)"
    ),
  },
  {
    source: "无法读取 HOME 目录",
    target: phrases(
      "无法读取 HOME 目录",
      "Failed to read HOME directory",
      "HOME ディレクトリを読み取れませんでした",
      "HOME 디렉터리를 읽지 못했습니다",
      "Не удалось прочитать каталог HOME"
    ),
  },
  {
    source: "id_token 格式无效",
    target: phrases(
      "id_token 格式无效",
      "Invalid id_token format",
      "id_token の形式が不正です",
      "id_token 형식이 올바르지 않습니다",
      "Неверный формат id_token"
    ),
  },
  {
    source: "解码 id_token 失败",
    target: phrases(
      "解码 id_token 失败",
      "Failed to decode id_token",
      "id_token のデコードに失敗しました",
      "id_token을 디코딩하지 못했습니다",
      "Не удалось декодировать id_token"
    ),
  },
  {
    source: "解析 id_token payload 失败",
    target: phrases(
      "解析 id_token payload 失败",
      "Failed to parse id_token payload",
      "id_token ペイロードの解析に失敗しました",
      "id_token payload를 파싱하지 못했습니다",
      "Не удалось разобрать payload id_token"
    ),
  },
  {
    source: "未检测到 scp 命令，请先安装 OpenSSH。",
    target: phrases(
      "未检测到 scp 命令，请先安装 OpenSSH。",
      "The scp command was not found. Install OpenSSH first.",
      "scp コマンドが見つかりません。先に OpenSSH をインストールしてください。",
      "scp 명령을 찾을 수 없습니다. 먼저 OpenSSH 를 설치하세요.",
      "Команда scp не найдена. Сначала установите OpenSSH."
    ),
  },
  {
    source: "读取本地账号存储失败",
    target: phrases(
      "读取本地账号存储失败",
      "Failed to read local account store",
      "ローカルのアカウント保存内容の読み取りに失敗しました",
      "로컬 계정 저장소를 읽지 못했습니다",
      "Не удалось прочитать локальное хранилище аккаунтов"
    ),
  },
  {
    source: "序列化默认账号存储失败",
    target: phrases(
      "序列化默认账号存储失败",
      "Failed to serialize default account store",
      "既定のアカウント保存内容のシリアライズに失敗しました",
      "기본 계정 저장소를 직렬화하지 못했습니다",
      "Не удалось сериализовать хранилище аккаунтов по умолчанию"
    ),
  },
  {
    source: "执行 scp 命令失败",
    target: phrases(
      "执行 scp 命令失败",
      "Failed to execute scp command",
      "scp コマンドの実行に失敗しました",
      "scp 명령을 실행하지 못했습니다",
      "Не удалось выполнить команду scp"
    ),
  },
  {
    source: "scp 命令返回非零状态",
    target: phrases(
      "scp 命令返回非零状态",
      "scp command returned a non-zero status",
      "scp コマンドが非ゼロステータスを返しました",
      "scp 명령이 0이 아닌 상태를 반환했습니다",
      "Команда scp завершилась с ненулевым статусом"
    ),
  },
  {
    source: "打开本地文件选择器失败",
    target: phrases(
      "打开本地文件选择器失败",
      "Failed to open local file picker",
      "ローカルファイル選択ダイアログを開けませんでした",
      "로컬 파일 선택기를 열지 못했습니다",
      "Не удалось открыть локальный выбор файла"
    ),
  },
  {
    source: "请先安装 cross 或 cargo-zigbuild，或补齐本机交叉编译工具链。",
    target: phrases(
      "请先安装 cross 或 cargo-zigbuild，或补齐本机交叉编译工具链。",
      "Install cross or cargo-zigbuild first, or complete the local cross-compilation toolchain.",
      "先に cross または cargo-zigbuild をインストールするか、ローカルのクロスコンパイルツールチェーンを整えてください。",
      "먼저 cross 또는 cargo-zigbuild 를 설치하거나 로컬 교차 컴파일 도구 모음을 준비하세요.",
      "Сначала установите cross или cargo-zigbuild либо настройте локальный toolchain для кросс-компиляции."
    ),
  },
  {
    source: "已尝试自动补齐本机 Linux 构建依赖，但仍未完成交叉编译。",
    target: phrases(
      "已尝试自动补齐本机 Linux 构建依赖，但仍未完成交叉编译。",
      "Tried to install the local Linux build dependencies automatically, but cross-compilation is still not ready.",
      "ローカルの Linux ビルド依存関係を自動補完しましたが、クロスコンパイル環境はまだ整っていません。",
      "로컬 Linux 빌드 의존성을 자동으로 보완했지만 교차 컴파일 환경이 아직 준비되지 않았습니다.",
      "Система попыталась автоматически установить локальные зависимости для сборки Linux, но кросс-компиляция по-прежнему не готова."
    ),
  },
  {
    source: "通过 cargo install 安装 cargo-zigbuild 失败",
    target: phrases(
      "通过 cargo install 安装 cargo-zigbuild 失败",
      "Failed to install cargo-zigbuild via cargo install",
      "cargo install による cargo-zigbuild のインストールに失敗しました",
      "cargo install 로 cargo-zigbuild 를 설치하지 못했습니다",
      "Не удалось установить cargo-zigbuild через cargo install"
    ),
  },
  {
    source: "未检测到 Homebrew，请先安装 brew 后再自动安装 Zig。",
    target: phrases(
      "未检测到 Homebrew，请先安装 brew 后再自动安装 Zig。",
      "Homebrew was not found. Install brew first before automatically installing Zig.",
      "Homebrew が見つかりません。Zig を自動インストールする前に brew をインストールしてください。",
      "Homebrew 를 찾지 못했습니다. Zig 를 자동 설치하기 전에 먼저 brew 를 설치하세요.",
      "Homebrew не найден. Сначала установите brew, а затем попробуйте автоматически установить Zig."
    ),
  },
  {
    source: "通过 Homebrew 安装 Zig 失败",
    target: phrases(
      "通过 Homebrew 安装 Zig 失败",
      "Failed to install Zig via Homebrew",
      "Homebrew による Zig のインストールに失敗しました",
      "Homebrew 로 Zig 를 설치하지 못했습니다",
      "Не удалось установить Zig через Homebrew"
    ),
  },
  {
    source: "通过 winget 安装 Zig 失败",
    target: phrases(
      "通过 winget 安装 Zig 失败",
      "Failed to install Zig via winget",
      "winget による Zig のインストールに失敗しました",
      "winget 으로 Zig 를 설치하지 못했습니다",
      "Не удалось установить Zig через winget"
    ),
  },
  {
    source: "通过 apt-get 安装 Zig 失败",
    target: phrases(
      "通过 apt-get 安装 Zig 失败",
      "Failed to install Zig via apt-get",
      "apt-get による Zig のインストールに失敗しました",
      "apt-get 으로 Zig 를 설치하지 못했습니다",
      "Не удалось установить Zig через apt-get"
    ),
  },
  {
    source: "通过 dnf 安装 Zig 失败",
    target: phrases(
      "通过 dnf 安装 Zig 失败",
      "Failed to install Zig via dnf",
      "dnf による Zig のインストールに失敗しました",
      "dnf 로 Zig 를 설치하지 못했습니다",
      "Не удалось установить Zig через dnf"
    ),
  },
  {
    source: "通过 yum 安装 Zig 失败",
    target: phrases(
      "通过 yum 安装 Zig 失败",
      "Failed to install Zig via yum",
      "yum による Zig のインストールに失敗しました",
      "yum 으로 Zig 를 설치하지 못했습니다",
      "Не удалось установить Zig через yum"
    ),
  },
  {
    source: "通过 pacman 安装 Zig 失败",
    target: phrases(
      "通过 pacman 安装 Zig 失败",
      "Failed to install Zig via pacman",
      "pacman による Zig のインストールに失敗しました",
      "pacman 으로 Zig 를 설치하지 못했습니다",
      "Не удалось установить Zig через pacman"
    ),
  },
  {
    source: "当前平台暂未内置一键安装 cargo-zigbuild / Zig，请先手动安装。",
    target: phrases(
      "当前平台暂未内置一键安装 cargo-zigbuild / Zig，请先手动安装。",
      "One-click installation for cargo-zigbuild / Zig is not built in on this platform yet. Please install them manually first.",
      "このプラットフォームでは cargo-zigbuild / Zig のワンクリックインストールはまだ組み込まれていません。先に手動でインストールしてください。",
      "현재 플랫폼에는 cargo-zigbuild / Zig 원클릭 설치가 아직 내장되어 있지 않습니다. 먼저 수동으로 설치하세요.",
      "На этой платформе пока нет встроенной установки cargo-zigbuild / Zig в один клик. Сначала установите их вручную."
    ),
  },
  {
    source: "自动安装 Linux 构建依赖后仍未检测到可用的 cargo-zigbuild / zig。",
    target: phrases(
      "自动安装 Linux 构建依赖后仍未检测到可用的 cargo-zigbuild / zig。",
      "cargo-zigbuild / zig is still not available after automatically installing the Linux build dependencies.",
      "Linux ビルド依存関係を自動インストールした後も、使用可能な cargo-zigbuild / zig が見つかりません。",
      "Linux 빌드 의존성을 자동 설치한 뒤에도 사용 가능한 cargo-zigbuild / zig 를 찾지 못했습니다.",
      "После автоматической установки зависимостей для сборки Linux доступные cargo-zigbuild / zig по-прежнему не найдены."
    ),
  },
  {
    source: "添加 Rust 目标失败",
    target: phrases(
      "添加 Rust 目标失败",
      "Failed to add Rust target",
      "Rust ターゲットの追加に失敗しました",
      "Rust 타깃 추가에 실패했습니다",
      "Не удалось добавить Rust target"
    ),
  },
  {
    source: "执行本地命令失败",
    target: phrases(
      "执行本地命令失败",
      "Failed to execute local command",
      "ローカルコマンドの実行に失敗しました",
      "로컬 명령을 실행하지 못했습니다",
      "Не удалось выполнить локальную команду"
    ),
  },
  {
    source: "详情: ",
    target: phrases(
      "详情: ",
      "Details: ",
      "詳細: ",
      "세부 정보: ",
      "Подробности: "
    ),
  },
];

function normalizePunctuation(text: string, locale: AppLocale): string {
  if (locale === "zh-CN" || locale === "ja-JP") {
    return text;
  }

  return text
    .replaceAll("：", ": ")
    .replaceAll("，", ", ")
    .replaceAll("。", ".")
    .replaceAll("（", "(")
    .replaceAll("）", ")")
    .replaceAll("…", "...");
}

function looksLikeExpiredAuthorizationError(raw: string): boolean {
  const normalized = raw.toLowerCase();
  const hasAuthExpiredSignal =
    normalized.includes("provided authentication token is expired") ||
    normalized.includes("your refresh token has already been used to generate a new access token") ||
    normalized.includes("please try signing in again") ||
    normalized.includes("token is expired");
  const hasUsageOrRefreshContext =
    normalized.includes("请求用量接口失败") ||
    normalized.includes("usage") ||
    normalized.includes("刷新登录令牌失败") ||
    normalized.includes("令牌刷新失败") ||
    normalized.includes("/oauth/token");

  return hasAuthExpiredSignal && hasUsageOrRefreshContext;
}

function looksLikeDeactivatedAccountError(raw: string): boolean {
  const normalized = raw.toLowerCase();
  return (
    normalized.includes("your openai account has been deactivated") ||
    normalized.includes("account has been deactivated") ||
    normalized.includes("account deactivated") ||
    normalized.includes("deactivated_user") ||
    (normalized.includes("deactivated") && normalized.includes("check your email")) ||
    normalized.includes("账号被封禁，请检查邮箱")
  );
}

export function localizeBackendError(raw: string, locale: AppLocale): string {
  if (!raw) {
    return raw;
  }

  if (looksLikeDeactivatedAccountError(raw)) {
    return DEACTIVATED_ACCOUNT_MESSAGE[locale];
  }

  if (looksLikeExpiredAuthorizationError(raw)) {
    return AUTH_EXPIRED_MESSAGE[locale];
  }

  let localized = raw;
  for (const replacement of REPLACEMENTS) {
    localized = localized.replaceAll(replacement.source, replacement.target[locale]);
  }

  return normalizePunctuation(localized, locale);
}
