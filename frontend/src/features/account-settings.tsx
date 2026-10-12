import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, failure, ApiFailure } from "../shared/api";
import { ErrorNotice, Field } from "../shared/ui";
import { useSession, type User } from "../app/session";
type Preview = { token: string; counts: Record<string, number> };
type Action = "avatar" | "name" | "username" | "password" | "logout" | "delete";
export function AccountSettings() {
  const session = useSession(),
    navigate = useNavigate(),
    user = session.user!;
  const [action, setAction] = useState<Action | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiFailure | null>(null),
    [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState(user.displayName),
    [username, setUsername] = useState(user.username),
    [renamePassword, setRenamePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined),
    [preview, setPreview] = useState<Preview | null>(null),
    [deletePassword, setDeletePassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [ack, setAck] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewSequence = useRef(0),
    previewController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      previewSequence.current++;
      previewController.current?.abort();
    },
    [],
  );
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (action && !dialog.current?.open) dialog.current?.showModal();
  }, [action]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  function leave(url: string) {
    dialog.current?.close();
    navigate(url, { replace: true, flushSync: true });
    session.setUser(null);
  }
  function clearDrafts() {
    previewSequence.current++;
    if (previewController.current) {
      previewController.current.abort();
      previewController.current = null;
      setBusy(false);
    }
    setPreviewLoading(false);
    setAvatar(undefined);
    setPreview(null);
    setRenamePassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDeletePassword("");
    setConfirmation("");
    setAck(false);
    setError(null);
    setMessage("");
  }
  function close() {
    dialog.current?.close();
    setAction(null);
    clearDrafts();
    trigger.current?.focus();
  }
  function open(next: Action, e: MouseEvent<HTMLButtonElement>) {
    if (busy) return;
    trigger.current = e.currentTarget;
    clearDrafts();
    setDisplayName(user.displayName);
    setUsername(user.username);
    setAction(next);
    if (next === "delete") void loadPreview();
  }
  async function loadPreview() {
    const sequence = ++previewSequence.current;
    const controller = new AbortController();
    previewController.current?.abort();
    previewController.current = controller;
    setPreviewLoading(true);
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const result = await api<Preview>("/me/deletion-preview", {
        signal: controller.signal,
      });
      if (sequence === previewSequence.current) setPreview(result);
    } catch (e) {
      if (sequence === previewSequence.current && !controller.signal.aborted)
        setError(failure(e));
    } finally {
      if (sequence === previewSequence.current) {
        previewController.current = null;
        setPreviewLoading(false);
        setBusy(false);
      }
    }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const next = await api<User>("/me", {
        method: "PATCH",
        body:
          action === "name"
            ? { displayName }
            : {
                username,
                ...(username.toLowerCase() !== user.username
                  ? { currentPassword: renamePassword }
                  : {}),
              },
      });
      session.setUser(next);
      close();
      setMessage("个人资料已保存。");
    });
  }
  async function chooseAvatar(file: File | undefined) {
    if (!file) return;
    await run(async () => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("请选择不超过 10 MiB 的 PNG、JPEG 或 WebP 图片。");
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 60000000)
          throw new Error("图片尺寸过大，请选择较小的图片。");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("当前浏览器无法处理图片。");
        const side = Math.min(bitmap.width, bitmap.height);
        context.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          256,
          256,
        );
        let encoded = canvas.toDataURL("image/webp", 0.85);
        if (
          !encoded.startsWith("data:image/webp;") ||
          encoded.length > 349550
        ) {
          context.globalCompositeOperation = "destination-over";
          context.fillStyle = "#fff";
          context.fillRect(0, 0, 256, 256);
          encoded = canvas.toDataURL("image/jpeg", 0.85);
        }
        if (encoded.length > 349550)
          throw new Error("图片压缩失败，请选择较小的图片。");
        setAvatar(encoded);
        setMessage("头像预览已生成，点击保存头像完成修改。");
      } finally {
        bitmap.close();
      }
    });
  }
  async function saveAvatar() {
    await run(async () => {
      const next = await api<User>("/me", {
        method: "PATCH",
        body: { avatar },
      });
      session.setUser(next);
      close();
      setMessage("头像已保存。");
    });
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (newPassword !== confirmPassword)
        throw new ApiFailure("两次输入的新密码不一致。", {
          code: "PASSWORD_MISMATCH",
        });
      await api("/me/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      leave("/login?passwordChanged=1");
    });
  }
  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!preview || !ack) return;
    await run(async () => {
      const result = await api("/me", {
        method: "DELETE",
        body: {
          currentPassword: deletePassword,
          confirmation,
          expectedToken: preview.token,
        },
      });
      leave(
        "/login?accountDeleted=1" +
          (result.demoCleanupPending ? "&demoCleanupPending=1" : ""),
      );
    });
  }
  function avatarImage(url: string | null | undefined) {
    return url ? (
      <img src={url} alt="用户头像" />
    ) : (
      <span aria-label="默认头像">{user.displayName.slice(0, 1)}</span>
    );
  }
  const shownAvatar = avatar === undefined ? user.avatarUrl : avatar;
  const title = action
    ? {
        avatar: "修改头像",
        name: "修改名称",
        username: "修改用户名",
        password: "修改密码",
        logout: "退出登录",
        delete: "删除账号",
      }[action]
    : "";
  return (
    <div className="account-settings">
      <p className="eyebrow">账户 / 赛事工作台</p>
      <div className="title-row">
        <h1>账户设置</h1>
        <Link to="/me/tournaments">我的赛事</Link>
      </div>
      <section className="panel" aria-labelledby="account-info-title">
        <h2 id="account-info-title">个人资料</h2>
        <div className="account-photo-row">
          <button
            className="account-avatar"
            aria-label="点击头像修改"
            disabled={busy}
            onClick={(e) => open("avatar", e)}
          >
            {avatarImage(user.avatarUrl)}
          </button>
          <p className="muted">点击头像修改</p>
        </div>
        <dl className="account-details">
          <div>
            <dt>显示名</dt>
            <dd>{user.displayName}</dd>
            <button disabled={busy} onClick={(e) => open("name", e)}>
              修改名称
            </button>
          </div>
          <div>
            <dt>用户名</dt>
            <dd>{user.username}</dd>
            <button disabled={busy} onClick={(e) => open("username", e)}>
              修改用户名
            </button>
          </div>
          <div>
            <dt>唯一 ID</dt>
            <dd>
              <code>{user.id}</code>
              <p className="muted">固定标识，修改名称不会改变。</p>
            </dd>
          </div>
        </dl>
      </section>
      <section className="panel" aria-labelledby="account-actions-title">
        <h2 id="account-actions-title">登录与账号</h2>
        <div className="account-action-row">
          <div>
            <h3>密码</h3>
            <p className="muted">修改后需要在所有设备重新登录。</p>
          </div>
          <button disabled={busy} onClick={(e) => open("password", e)}>
            修改密码
          </button>
        </div>
        <div className="account-action-row">
          <div>
            <h3>退出登录</h3>
            <p className="muted">结束当前设备的会话，保留账号和赛事。</p>
          </div>
          <button disabled={busy} onClick={(e) => open("logout", e)}>
            退出登录
          </button>
        </div>
        <div className="account-action-row">
          <div>
            <h3>删除账号</h3>
            <p className="muted">
              注销账号，并删除您目前拥有的赛事及其配置。已不属于您的赛事会保留。
            </p>
          </div>
          <button
            className="danger"
            disabled={busy}
            onClick={(e) => open("delete", e)}
          >
            删除账号
          </button>
        </div>
      </section>
      {message && !action && <p role="status">{message}</p>}
      <dialog
        ref={dialog}
        className="account-dialog"
        aria-labelledby="account-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy || previewLoading) close();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const items = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'input:not(:disabled),button:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
              ),
            ).filter((el) => el.getClientRects().length > 0),
            first = items[0],
            last = items.at(-1);
          if (!first) {
            e.preventDefault();
            return;
          }
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        {action && (
          <>
            <h2 id="account-dialog-title">{title}</h2>
            {action === "avatar" && (
              <fieldset disabled={busy} className="account-fieldset">
                <div className="account-avatar account-avatar-preview">
                  {avatarImage(shownAvatar)}
                </div>
                <Field label="选择头像图片">
                  <input
                    autoFocus
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      void chooseAvatar(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </Field>
                <p className="muted">
                  PNG、JPEG 或 WebP，最大 10 MiB。自动居中裁切并压缩。
                </p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={!shownAvatar}
                    onClick={() => setAvatar(null)}
                  >
                    移除头像
                  </button>
                </div>
                <div className="actions">
                  <button onClick={close}>取消</button>
                  <button
                    className="primary"
                    disabled={avatar === undefined}
                    onClick={() => void saveAvatar()}
                  >
                    保存头像
                  </button>
                </div>
              </fieldset>
            )}
            {(action === "name" || action === "username") && (
              <form onSubmit={saveProfile}>
                <fieldset disabled={busy} className="account-fieldset">
                  {action === "name" ? (
                    <>
                      <Field label="显示名">
                        <input
                          autoFocus
                          required
                          maxLength={40}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </Field>
                      <p className="muted">
                        可使用中文，显示在账户和赛事工作台中。
                      </p>
                    </>
                  ) : (
                    <>
                      <Field label="用户名">
                        <input
                          autoFocus
                          required
                          minLength={3}
                          maxLength={32}
                          pattern="[A-Za-z0-9_]+"
                          autoComplete="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </Field>
                      <p className="muted">
                        用于登录，3–32
                        位英文、数字或下划线。修改后使用新用户名登录。
                      </p>
                      {username.toLowerCase() !== user.username && (
                        <Field label="修改用户名的当前密码">
                          <input
                            required
                            type="password"
                            autoComplete="current-password"
                            value={renamePassword}
                            onChange={(e) => setRenamePassword(e.target.value)}
                          />
                        </Field>
                      )}
                    </>
                  )}
                  <div className="actions">
                    <button type="button" onClick={close}>
                      取消
                    </button>
                    <button className="primary">保存个人资料</button>
                  </div>
                </fieldset>
              </form>
            )}
            {action === "password" && (
              <form onSubmit={changePassword}>
                <fieldset disabled={busy} className="account-fieldset">
                  <input
                    type="hidden"
                    name="username"
                    autoComplete="username"
                    value={user.username}
                  />
                  <Field label="当前密码">
                    <input
                      autoFocus
                      required
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </Field>
                  <Field label="新密码">
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Field>
                  <Field label="确认新密码">
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </Field>
                  <div className="actions">
                    <button type="button" onClick={close}>
                      取消
                    </button>
                    <button className="primary">修改密码并重新登录</button>
                  </div>
                </fieldset>
              </form>
            )}
            {action === "logout" && (
              <>
                <p>确认退出当前设备？您的账号、个人资料和赛事会保留。</p>
                <div className="actions">
                  <button
                    autoFocus
                    disabled={busy && !previewLoading}
                    onClick={close}
                  >
                    取消
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api("/auth/logout", { method: "POST" });
                        leave("/tournaments");
                      })
                    }
                  >
                    确认退出登录
                  </button>
                </div>
              </>
            )}
            {action === "delete" && (
              <>
                <p>
                  即将永久删除 <strong>@{user.username}</strong>{" "}
                  的账号。赛事范围只按<strong>当前所有权</strong>
                  判断：创建赛事时默认由您拥有，已转交给他人的赛事不在删除范围内。
                </p>
                {preview && (
                  <dl className="account-delete-counts">
                    {Object.entries({
                      sessions: "登录会话",
                      series: "当前拥有的系列",
                      tournaments: "当前拥有的赛事",
                      configurations: "赛事配置",
                      snapshots: "冻结快照",
                      schedules: "赛事时间计划",
                      referenceDemos: "独立演示空间",
                      catalogRequests: "目录请求记录",
                    }).map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>{preview.counts[key]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p>
                  账号资料、头像、密码凭据及上述自身关联数据将永久删除，无法恢复。
                </p>
                {preview && (
                  <form onSubmit={deleteAccount}>
                    <fieldset disabled={busy} className="account-fieldset">
                      <input
                        type="hidden"
                        name="username"
                        autoComplete="username"
                        value={user.username}
                      />
                      <Field label="注销验证密码">
                        <input
                          autoFocus
                          required
                          type="password"
                          autoComplete="current-password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                        />
                      </Field>
                      <Field label="输入当前用户名确认">
                        <input
                          required
                          autoComplete="off"
                          value={confirmation}
                          onChange={(e) => setConfirmation(e.target.value)}
                        />
                      </Field>
                      <label className="account-ack">
                        <input
                          required
                          type="checkbox"
                          checked={ack}
                          onChange={(e) => setAck(e.target.checked)}
                        />
                        我了解以上数据将永久删除，无法恢复。
                      </label>
                      <div className="actions">
                        <button type="button" onClick={close}>
                          取消
                        </button>
                        <button
                          className="danger"
                          disabled={!ack || confirmation !== user.username}
                        >
                          永久删除账号及数据
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}
                {!preview && (
                  <div className="actions">
                    <button
                      autoFocus
                      disabled={busy && !previewLoading}
                      onClick={close}
                    >
                      取消
                    </button>
                    {error && (
                      <button
                        disabled={busy}
                        onClick={() => void loadPreview()}
                      >
                        重新读取删除范围
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {busy && <p role="status">处理中…</p>}
            {message && <p role="status">{message}</p>}
            {error && <ErrorNotice error={error} />}
          </>
        )}
      </dialog>
    </div>
  );
}
