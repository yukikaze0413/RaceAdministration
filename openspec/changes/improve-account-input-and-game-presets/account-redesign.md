# 账户重规划（2026-10-06）
用户已确认注销指永久删除数据库中的账号与相关信息，不是退出登录。
参考 GitHub 个人资料、用户名变更和删除账户流程，以及 Google 个人信息分组：
- https://docs.github.com/en/account-and-profile/tutorials/personalize-your-profile
- https://docs.github.com/en/account-and-profile/how-tos/account-management/changing-your-username
- https://docs.github.com/en/account-and-profile/how-tos/account-management/deleting-your-personal-account
- https://support.google.com/accounts/answer/27442

采用账户概览、个人资料（头像/显示名/登录用户名）、登录与安全、危险操作四层。稳定 UUID 只读，修改用户名不改变所有权；用户名改变须验证当前密码。头像仅接受 JPEG/PNG/WebP，客户端中心裁切压缩，服务器再次解码、限制像素并转 WebP 去除元数据，数据库内保存，无外部图片 URL。
注销使用当前密码、当前用户名确认及预览令牌；一次事务删除会话、目录幂等记录、自有赛事配置及冻结快照、赛事、系列和账号。历史跨账号引用使操作返回冲突，避免删除他人信息。预览后数据改变必须重新确认。只用临时账户验证删除，不操作真实用户账号。
验收：保存后刷新一致、ID/所有权稳定、用户名冲突与无效头像不写入、错误密码/过期预览不删除、数据库故障全量回滚、他人数据完整、移动端无横向溢出。
