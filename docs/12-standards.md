# 遵循的标准

> 状态：提议，范围待定（2026-11-26）。「代码要符合 ISO 等国际相关标准」已定。对着哪些标准，产品负责人还没有裁定；下面的清单和每一条的做法都是提议。标准的编号、名称与版本，2026-11-26 在各标准组织自己的目录上核对过，见第 5 节。「现在做到哪一步」只写在仓库里核对过的事实。

## 1 这一篇说什么

产品负责人的原话是「代码要符合 ISO 等国际相关标准」。整理时的读法：

- 定一份标准对照和相应的检查，写明对着哪些标准、各用来做什么、现在做到哪一步、还缺什么、怎么验证。
- 不是去做认证。ISO/IEC 27001、ISO/IEC 42001 这一类管理体系标准，要求是提给一个组织的管理体系的；认证是组织层面的事，不在代码里。代码这边能做的，是把标准里和开发有关的内容落成做法与检查。
- 所以本文不下「符合某标准」这样的结论，只写对着什么、做了什么、还缺什么。

范围是匠心与 Kun 两个仓库的代码和发布物。国内的合规要求（等级保护、商用密码、个人信息保护）不在本文里；Kun 的需求文档[第 13 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/13-security.md)的第 13.12 节有一张占位表。

## 2 对照表

| 方面 | 对着的标准 | 用来做什么 |
|---|---|---|
| 软件质量 | ISO/IEC 25010:2023 | 质量要求的分类。评审和写文档时当清单用 |
| 代码质量的自动度量 | ISO/IEC 5055:2021 | 用静态分析在源码里检出并计数违反良好架构与编码实践的地方，当代码质量的度量 |
| 过程与测试 | ISO/IEC/IEEE 12207:2026；ISO/IEC/IEEE 29119 的第 1 至 4 部分 | 开发过程怎么分、测试文档怎么写的参照 |
| 安全开发 | ISO/IEC 27001:2022 与 ISO/IEC 27002:2022 里和安全开发有关的控制项；ISO/IEC 27034；工业场景另加 IEC 62443-4-1:2018、IEC 62443-4-2:2019 | 安全开发的流程；组件的安全要求 |
| 物料清单与许可 | ISO/IEC 5962:2021（SPDX）；ISO/IEC 5230:2020（OpenChain） | 物料清单的格式；开源许可怎么管 |
| AI | ISO/IEC 42001:2023；ISO/IEC 23894:2023；ISO/IEC 22989:2022 | AI 的管理、风险、术语 |
| 工业 | IEC 62264（即 ISA-95）；ISO 22400；IEC 62541（OPC UA）；IEC 61512 | 企业系统与控制系统之间的数据模型；制造运行的指标；设备接入；批控制 |
| 数据的写法 | ISO 8601-1:2019；ISO 3166-1:2020；ISO 4217:2015；ISO 639:2023 | 接口与存储里日期时间、国家、货币、语言怎么写 |
| 界面 | ISO/IEC 40500:2025（即 WCAG 2.2）；ISO 9241 的几个部分 | 无障碍；易用 |
| 身份与访问 | ISO/IEC 24760；ISO/IEC 29146:2024；OAuth 2.0、OpenID Connect、SCIM | 身份管理与访问管理的概念和框架；登录与目录同步的协议 |

## 3 每一方面现在做到哪一步

这一节只写仓库里核对过的事实。每一方面都还没有逐条对着标准的条文核过；「已有」写的是和它有关、现在在跑的检查与做法。Kun 的检查在 CI 里，PR 的必需检查是「CI 汇总」。匠心的 CI 现在只构建文档站，代码的检查在本机跑，命令列在匠心的 [AGENTS.md](https://github.com/CavaiLAB/jiangxin/blob/main/AGENTS.md) 里。

### 3.1 软件质量

- **已有。** 没有按这份标准做过分类。质量要求和门禁清单写在 Kun 需求文档的[第 14 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/14-quality.md)，那里按测试层次和门禁来组织，不按质量特性。
- **还缺。** 把质量要求按标准的质量特性对一遍，定下评审时用的清单。
- **怎么验证。** 没有定。提议：清单定了以后，评审记录里逐项有结论。

### 3.2 代码质量的自动度量

- **已有，Kun。** 警告即错误、代码分析的推荐规则、构建时强制代码风格，见 [Directory.Build.props](https://github.com/CavaiLAB/kun/blob/main/Directory.Build.props)。公共 API 清单、包的档位声明、禁用符号、平台自己的分析器，见 [Directory.Build.targets](https://github.com/CavaiLAB/kun/blob/main/Directory.Build.targets)。格式核对与依赖方向检查在 [ci.yml](https://github.com/CavaiLAB/kun/blob/main/.github/workflows/ci.yml) 里。界面包有代码规则、类型检查、单元测试、依赖边界、循环依赖几道门禁，见 [qian-ui.yml](https://github.com/CavaiLAB/kun/blob/main/.github/workflows/qian-ui.yml)。
- **已有，匠心。** 各包的类型检查与单测；shell 脚本的变量写法检查，见 [tools/check-shell-vars.mjs](https://github.com/CavaiLAB/jiangxin/blob/main/tools/check-shell-vars.mjs)。都在本机跑。
- **还缺。** 静态分析的规则没有对着这份标准归类，也没有按它出度量。匠心的检查没有进 CI。
- **怎么验证。** Kun 看 PR 上的「CI 汇总」。匠心现在只能在本机照 AGENTS.md 里的命令跑一遍。

### 3.3 过程与测试

- **已有，过程。** 两个仓库的改动都走分支和 PR，见[协作约定](14-governance.md)。Kun 另有任务文件与看板，见 [pm/](https://github.com/CavaiLAB/kun/blob/main/pm/README.md)。
- **已有，Kun 的测试。** 单元测试；集成测试，用容器起真实的依赖；运行时语义的一致性测试，见 [tck/runtime](https://github.com/CavaiLAB/kun/blob/main/tck/runtime/README.md)；冻结契约的正例与反例，见 [contracts/v0](https://github.com/CavaiLAB/kun/blob/main/contracts/v0/README.md)；NativeAOT 的发布与冒烟。覆盖率每次收集并上传。
- **已有，匠心的测试。** 各包的单测、桌面壳的单测、发行目录的启动前检查。都在本机跑。
- **还缺。** 覆盖率没有设阈值。测试文档没有照 ISO/IEC/IEEE 29119-3 的结构整理过。匠心的测试没有进 CI。
- **怎么验证。** Kun 的测试结果、覆盖率与证据随每次 CI 运行上传。

### 3.4 安全开发

- **已有，Kun。**
  - 依赖的漏洞审计：直接依赖和传递依赖都查，命中就让还原失败，见 [Directory.Build.props](https://github.com/CavaiLAB/kun/blob/main/Directory.Build.props)。
  - profile 生效配置里的明文密钥扫描，在 [ci.yml](https://github.com/CavaiLAB/kun/blob/main/.github/workflows/ci.yml) 的「构建与门禁」作业里。
  - 镜像的门禁：物料清单、漏洞扫描、签名与验签、配置漂移、非 root 与只读根文件系统。现在在 CI 里对自检镜像跑通，产品镜像还没有接进来，见 [deploy/images](https://github.com/CavaiLAB/kun/blob/main/deploy/images/README.md)。
  - 发版要审批，用可信发布换短期凭据，见 [release.yml](https://github.com/CavaiLAB/kun/blob/main/.github/workflows/release.yml)。
  - 权限、令牌、审计、密钥的设计，写在需求文档[第 13 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/13-security.md)。
- **已有，匠心。** 外联检查：在不通外网的容器网络里，看实例想连哪些地址，见 [tests/egress](https://github.com/CavaiLAB/jiangxin/blob/main/tests/egress/README.md)。发行目录的启动前检查与设置锁定验证，见[发行目录的说明](https://github.com/CavaiLAB/jiangxin/blob/main/distribution/README.md)。都在本机跑。
- **还缺。** 全仓库的密钥扫描。静态安全扫描。依赖的自动更新。匠心的依赖没有漏洞审计。两个仓库都没有写明安全问题怎么报告。
- **怎么验证。** 已有的几项看 CI 的结果和镜像自检上传的证据。提议：缺的检查补上以后，各自成为 PR 的必需检查。

### 3.5 物料清单与许可

- **已有，Kun。** 镜像的物料清单用 SPDX 的 JSON 格式生成，签名时一起附上证明，现在只在自检镜像上，见 [scripts/images.py](https://github.com/CavaiLAB/kun/blob/main/scripts/images.py)。.NET 包、命令行与前端包的许可是 MIT，见[协作约定](14-governance.md)。
- **已有，匠心。** 打进插件包的第三方代码与各自的许可，列在界面包的 [NOTICE.md](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/NOTICE.md) 和品牌包的 [NOTICE.md](https://github.com/CavaiLAB/jiangxin/blob/main/packages/brand-theme/NOTICE.md) 里。
- **还缺。** 许可白名单的检查。匠心的发布物没有物料清单。匠心自己的代码用什么许可，待定。生成的物料清单是 SPDX 的哪一版，没有核对；ISO/IEC 5962:2021 写的是 SPDX 2.2.1。
- **怎么验证。** 镜像自检把物料清单、扫描报告、验签结果上传成证据。

### 3.6 AI

- **已有。** 审计：Kun 的审计记录与业务写入在同一个事务里，串成哈希链，事后可以核验，见[审计的说明](https://github.com/CavaiLAB/kun/blob/main/docs/security/audit-log.md)。
- **已定，还没有实现。** Agent 发出去的内容要由人审核，起步出站、入站两道都必审。等人点头的事记在平台；标了要人确认的能力，由平台自己停下来等人点；审批时模型默认不参与。
- **还缺。** 没有 AI 风险的清单。术语没有对着 ISO/IEC 22989 核过。
- **怎么验证。** 没有定。

### 3.7 工业

- **已有。** 没有对着这些标准做的内容。仓库里和工业有关的，是一个设备台账的插件样板，数据是假的，见[样板的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/enterprise-workbench/README.md)。
- **还缺。** 数据模型、指标、设备接入各对着哪一份、对到哪一层，没有定。
- **怎么验证。** 没有定。

工业场景见[工业智能制造](02-industrial-forms.md)，历史系统怎么接见[历史系统接入](07-legacy-systems.md)。

### 3.8 数据的写法

- **已有，Kun 的契约。** 时间写成带时区的 RFC 3339 字符串，见[事件信封](https://github.com/CavaiLAB/kun/blob/main/contracts/v0/README.md)与[数据契约的规格](https://github.com/CavaiLAB/kun/blob/main/docs/prd/specs/data-contracts.md)；RFC 3339 在摘要里写明它是 ISO 8601 的一个子集（profile）。语言用 BCP 47 的语言标签，见错误码目录的多语言文案。国家用 ISO 3166-1 的两字母代码，见 [SCIM 的用户资源](https://github.com/CavaiLAB/kun/blob/main/contracts/scim/v2/README.md)。
- **还缺。** 货币怎么写，没有约定。这几条散在各份契约里，没有汇成两个仓库共用的一条规矩。
- **怎么验证。** 契约是 JSON Schema 加正例、反例，测试里逐个核对。

### 3.9 界面

- **已有，匠心。** 界面包的说明里写了读屏用的名字、键盘与焦点的规矩，并在真的 DSH 里按键核对过，见[界面包的说明](https://github.com/CavaiLAB/jiangxin/blob/main/packages/ui-kit/README.md)。
- **已有，Kun。** 现有界面包的浏览器测试里用 axe 做无障碍扫描。
- **还缺。** 匠心没有自动的无障碍检查，也没有组件的渲染测试；界面只在网页端核对过。
- **怎么验证。** 没有定。

### 3.10 身份与访问

- **已有，Kun。** 身份服务按 OAuth 2.0 与 OpenID Connect 做，浏览器登录用授权码加 PKCE，见[身份服务](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Identity.Server/README.md)与[登录组件](https://github.com/CavaiLAB/kun/blob/main/src/Kun.Identity.Client/README.md)的说明。SCIM 的核心 Schema（RFC 7643）已经冻结成契约；SCIM 的服务端（RFC 7644）是规划，见 [contracts/scim/v2](https://github.com/CavaiLAB/kun/blob/main/contracts/scim/v2/README.md)。权限怎么判，见[在平台上做开发](11-development.md)。
- **还缺。** 概念和术语没有对着 ISO/IEC 24760、ISO/IEC 29146 核过。
- **怎么验证。** 身份与授权的测试在 Kun 的 CI 里。

## 4 还缺的检查

把上一节的「还缺」里属于检查的汇在一起：

| 缺什么 | 哪边 | 现在的情况 |
|---|---|---|
| 代码的检查进 CI | 匠心 | CI 只构建文档站，代码的检查在本机跑 |
| 全仓库的密钥扫描 | 两边 | Kun 只扫 profile 生效配置里的明文密钥 |
| 静态安全扫描 | 两边 | 没有 |
| 依赖的漏洞审计 | 匠心 | 没有。Kun 有 |
| 依赖的自动更新 | 两边 | 没有 |
| 许可白名单 | 两边 | 没有 |
| 覆盖率阈值 | Kun | 覆盖率有收集，没有阈值 |
| 产品镜像的物料清单、扫描与签名 | Kun | 门禁已有，只在自检镜像上跑通 |
| 自动的无障碍检查 | 匠心 | 没有 |
| 安全问题的报告入口 | 两边 | 没有 |

Kun 的需求文档[第 14 章](https://github.com/CavaiLAB/kun/blob/main/docs/prd/14-quality.md)的第 14.4 节，把密钥形态扫描、许可证白名单、单测覆盖率阈值列在门禁清单里；这三项还没有落到 CI。

## 5 标准的编号、名称与版本

名称照各标准组织目录上的写法抄，不翻译。ISO 与 ISO/IEC 的读的是 ISO 的标准目录，IEC 的读的是 IEC 的网上商店，RFC 读的是 RFC 编辑页，OpenID Connect 读的是 OpenID 基金会的规范页。国家标准一栏只写全国标准信息公共服务平台上写明了采标情况的，「等同采用」「修改采用」「非等效采用」是那里的用语。多部分的标准只列核对过的部分。

| 标准 | 正式名称 | 版本 | 对应的国家标准 |
|---|---|---|---|
| ISO/IEC 25010:2023 | Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model | 第 2 版 | GB/T 25000.10-2016，修改采用的是 2011 年版 |
| ISO/IEC 5055:2021 | Information technology — Software measurement — Software quality measurement — Automated source code quality measures | 第 1 版 | |
| ISO/IEC/IEEE 12207:2026 | Systems and software engineering — Software life cycle processes | 第 2 版，取代 2017 年版 | GB/T 8566-2022，等同采用的是 2017 年版 |
| ISO/IEC/IEEE 29119-1:2022 | Software and systems engineering — Software testing — Part 1: General concepts | 第 2 版 | GB/T 38634.1-2020，修改采用的是 2013 年版 |
| ISO/IEC/IEEE 29119-2:2021 | Software and systems engineering — Software testing — Part 2: Test processes | 第 2 版 | GB/T 38634.2-2020，修改采用的是 2013 年版 |
| ISO/IEC/IEEE 29119-3:2021 | Software and systems engineering — Software testing — Part 3: Test documentation | 第 2 版 | GB/T 38634.3-2020，修改采用的是 2013 年版 |
| ISO/IEC/IEEE 29119-4:2021 | Software and systems engineering — Software testing — Part 4: Test techniques | 第 2 版 | GB/T 38634.4-2020，修改采用的是 2015 年版 |
| ISO/IEC 27001:2022 | Information security, cybersecurity and privacy protection — Information security management systems — Requirements | 第 3 版，另有 Amd 1:2024 | GB/T 22080-2025，等同采用 |
| ISO/IEC 27002:2022 | Information security, cybersecurity and privacy protection — Information security controls | 第 3 版 | |
| ISO/IEC 27034-1:2011 | Information technology — Security techniques — Application security — Part 1: Overview and concepts | 第 1 版，另有 Cor 1:2014。这个系列还有别的部分 | |
| IEC 62443-4-1:2018 | Security for industrial automation and control systems - Part 4-1: Secure product development lifecycle requirements | 第 1.0 版 | GB/T 42457-2023，等同采用 |
| IEC 62443-4-2:2019 | Security for industrial automation and control systems - Part 4-2: Technical security requirements for IACS components | 第 1.0 版 | GB/T 42456-2023，等同采用 |
| ISO/IEC 5962:2021 | Information technology — SPDX® Specification V2.2.1 | 第 1 版。目录上标着即将被新版取代，新版的名称写的是 SPDX V3.0 | |
| ISO/IEC 5230:2020 | Information technology — OpenChain Specification | 第 1 版 | |
| ISO/IEC 42001:2023 | Information technology — Artificial intelligence — Management system | 第 1 版 | GB/T 45081-2024，等同采用 |
| ISO/IEC 23894:2023 | Information technology — Artificial intelligence — Guidance on risk management | 第 1 版 | |
| ISO/IEC 22989:2022 | Information technology — Artificial intelligence — Artificial intelligence concepts and terminology | 第 1 版。修订件在制定中，还没有发布 | |
| IEC 62264-1:2013 | Enterprise-control system integration - Part 1: Models and terminology | 第 2.0 版 | GB/T 20720.1-2019，等同采用 |
| IEC 62264-2:2026 | Enterprise-Control System Integration - Part 2: Object models and relationships for interfaces between manufacturing operations and business functions | 第 3.0 版，取代 2013 年版 | |
| IEC 62264-3:2016 | Enterprise-control system integration - Part 3: Activity models of manufacturing operations management | 第 2.0 版 | |
| ISO 22400-1:2014 | Automation systems and integration — Key performance indicators (KPIs) for manufacturing operations management — Part 1: Overview, concepts and terminology | 第 1 版 | |
| ISO 22400-2:2014 | Automation systems and integration — Key performance indicators (KPIs) for manufacturing operations management — Part 2: Definitions and descriptions | 第 1 版，另有 Amd 1:2017。目录上标着即将被新版取代 | |
| IEC 62541-1:2025 | OPC unified architecture - Part 1: Overview and concepts | 第 1.0 版，取代 2020 年的技术报告 | GB/T 33863.1-2017，等同采用的是 2010 年的技术报告 |
| IEC 62541-3:2025、-4:2025、-5:2026、-6:2025 | OPC unified architecture - Part 3: Address Space Model；Part 4: Services；Part 5: Information Model；Part 6: Mappings | 都是第 4.0 版，取代 2020 年版 | |
| IEC 61512-1:2026 | Batch control - Part 1: Models and terminology | 第 2.0 版，取代 1997 年版 | GB/T 19892.1-2005，等同采用的是 1997 年版 |
| ISO 8601-1:2019 | Date and time — Representations for information interchange — Part 1: Basic rules | 第 1 版，另有 Amd 1:2022。在修订 | GB/T 7408.1-2023，等同采用 |
| ISO 3166-1:2020 | Codes for the representation of names of countries and their subdivisions — Part 1: Country code | 第 4 版 | GB/T 2659.1-2022，修改采用 |
| ISO 4217:2015 | Codes for the representation of currencies | 第 8 版 | GB/T 12406-2022，修改采用 |
| ISO 639:2023 | Code for individual languages and language groups | 第 2 版 | |
| RFC 3339 | Date and Time on the Internet: Timestamps | 2002 年 7 月 | |
| RFC 5646（BCP 47） | Tags for Identifying Languages | 2009 年 9 月 | |
| ISO/IEC 40500:2025 | Information technology — W3C Web Content Accessibility Guidelines (WCAG) 2.2 | 第 2 版，取代 2012 年版。目录上标着即将被新版取代 | GB/T 37668-2026，非等效采用，2027-02-01 实施 |
| ISO 9241-11:2018 | Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts | 第 2 版 | |
| ISO 9241-110:2020 | Ergonomics of human-system interaction — Part 110: Interaction principles | 第 2 版 | |
| ISO 9241-210:2019 | Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems | 第 2 版 | |
| ISO 9241-171:2025 | Ergonomics of human-system interaction — Part 171: Software accessibility | 第 2 版，取代 2008 年版 | |
| ISO/IEC 24760-1:2025 | Information security, cybersecurity and privacy protection — A framework for identity management — Part 1: Core concepts and terminology | 第 3 版 | |
| ISO/IEC 24760-2:2025 | Information security, cybersecurity and privacy protection — A framework for identity management — Part 2: Reference architecture and requirements | 第 2 版 | |
| ISO/IEC 24760-3:2025 | Information security, cybersecurity and privacy protection — A framework for identity management — Part 3: Practice | 第 2 版 | |
| ISO/IEC 29146:2024 | Information technology — Security techniques — A framework for access management | 第 2 版，取代 2016 年版 | |
| RFC 6749 | The OAuth 2.0 Authorization Framework | 2012 年 10 月 | |
| OpenID Connect Core 1.0 | OpenID Connect Core 1.0 incorporating errata set 2 | 2023 年 12 月 15 日。ISO 的编号是 ISO/IEC 26131:2024 | |
| RFC 7643、RFC 7644 | System for Cross-domain Identity Management: Core Schema；System for Cross-domain Identity Management: Protocol | 2015 年 9 月 | |

有几份国家标准采用的是国际标准的上一版，表里写明了是哪一版。标准会换版：表里标着「即将被新版取代」「在修订」的，换版以后要重新核对。

## 6 待定

| 事项 | 现在的情况 |
|---|---|
| 对着哪些标准 | 提议，见第 2 节。产品负责人没有裁定 |
| 缺的检查先补哪些 | 没有定，清单见第 4 节 |
| 匠心的代码检查什么时候进 CI | 待定，见[协作约定](14-governance.md) |
| 各方面怎么验证 | 标着「没有定」的几项，见第 3 节 |
| 标准换版以后谁来重新核对、多久核一次 | 没有定 |
| 要不要做某一项认证 | 没有问过。本文的读法是不做认证，见第 1 节 |
