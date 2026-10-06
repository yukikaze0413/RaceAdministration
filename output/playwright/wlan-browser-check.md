# WLAN实际页面浏览器测试

2026-10-05，真实可见Edge，地址http://10.82.238.254:5173。

新测试账号wlan_test_20261005，显示名WLAN浏览器测试。一位密码通过注册，跳到/login?registered=1且密码已清空；再次输入同一密码登录，进入/me/tournaments并显示测试账号。创建赛事页面正常打开，仍显示卡牌/格斗分类和ISO8601时间输入，未宣称新游戏或日期业务已实施；本轮未创建赛事。

360px页面实测documentElement.scrollWidth=345，无整页横向溢出；保存360/1440截图wlan-create-360.png、wlan-create-1440.png。浏览器控制台仅记录favicon.ico 404，无其他错误/警告。本次测试运行在开发服务及本地实际数据库，新增一个专用测试账号，服务和浏览器保留供用户测试。

原始导航/表单快照在.playwright-cli/page-2026-10-05T07-56至07-59时间段。内置CUA工具因sandbox helper启动失败，使用Playwright CLI替代并完成浏览器操作；没有使用接口请求替代注册/登录点击流程。