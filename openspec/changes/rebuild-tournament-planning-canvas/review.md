# 独立只读评审与处置

日期：2026-10-13。HEAD：5e55bc7893aeee2472c40be51e3b9921910a4623，加本 change 工作区差异。两位探子均 fork_turns=none，仅探索/核验，不修改代码。评审后主代理亲读涉及代码并修复，未复用探子；最终回归由主代理执行。

## 领域/HTTP 评审：canvas_domain_review（complete）

1. selector 错误接受 reverse 并按 top 处理：已以失败测试复现；按组件区分 selector top/random、generator reverse/random，非法配置拒绝。
2. connect 缺端点、encapsulate selected 非数组返回 TypeError：已通过真实 HTTP 复现 500；增加编辑入参校验与端点对象校验，当前返回 422。
3. 未知样例直接 Error：改为明确 NOT_FOUND/404；真实 HTTP 测试通过。

出处：canvas-boundaries.test.js 的 wrong component、canvas-http.test.js 的 client errors。另补 nested condition 未知字段测试，禁止在规划条件中嵌入比分。

## 界面评审：canvas_ui_review（complete）

1. 同路径 canvas 查询参数变化未重新加载：真实 Edge 同路径导航已复现旧名称残留；加载随 canvasId 变化，自身保存/采用远端后的 query 更新复用已加载结果，保留编辑历史。
2. 保存锁定期间属性仍可编辑：真实 Edge 延迟保存已复现属性输入 enabled；统一 disabled fieldset 锁定属性全部控件，实际保存中的名称和 BO 均不可编辑。

出处：canvas-lab.spec.ts 的属性表单、同路径查询场景。两位评审没有发现额外已核实阻断项；他们未执行最终全量回归。未保存评审前的逐文件哈希，不把评审称为最终修复版本的二次独立签署。最终文件指纹与验证结果另见 evidence/source-hashes.json 和 acceptance.md。

## 主代理核验修正

- SVG 原测量使用按钮中心，且 input/output 同名 collection 共用锚点键；真实几何失败分别记录 50.96/42.68 px 偏差。改为测量端口圆点，并在键中加入方向；三宽度端点误差 <1px。
- 清空外部种子映射原被参数 merge 保留；真实表单失败后显式传 null，列出连接影响，确认删除并重载保持空映射。
- 子图集合出口自动派生配套种子映射；对未连接边界也校验真实目标类型。
- 预设内部连接修改也须先转自定义；缩容和边界删除保留原图直到明确确认。

所有处置均以新增回归或对应真实 Edge 场景验证；主代理最终347后端、94前端、10 Edge及类型/构建通过。工程通过不等于用户已接受。
