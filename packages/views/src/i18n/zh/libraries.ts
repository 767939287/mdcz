import type { Messages } from "../en";

export const libraries: Messages["libraries"] = {
  title: "库配置",
  description: "一个库由来源目录、带命名模板的输出目录以及视频的放置方式组成，刮削结果发布到库中。",
  add: "新建库",
  createFirst: "创建第一个库",
  createFirstDescription: "刮削前，先告诉 MDCz 视频从哪里来、整理好的影片放到哪里。之后可以再添加更多库。",
  importExisting: "我已有媒体库",
  importExistingDescription: "指向一个已有视频和 NFO 的目录，MDCz 只读取现有内容，不移动也不改写任何文件。",
  importTitle: "导入已有媒体库",
  importSave: "保存并导入",
  health: {
    title: "健康状况",
    movies: (count: number) => `已索引 ${count} 部影片`,
    notImported: "这个库还没有被索引。导入后即可看到它缺什么。",
    import: "立即导入",
    view: "查看",
    pending: (count: number) => `${count} 个文件在待处理列表`,
    allGood: "没有发现缺失。",
  },
  edit: "编辑",
  delete: "删除",
  deleteTitle: (name: string) => `删除库「${name}」？`,
  deleteDescription: "文件和 NFO 保持原样，只删除这个库的设置和监控状态。",
  saved: "库已保存",
  deleted: "库已删除",
  loadFailed: (error: string) => `无法加载库：${error}`,
  editorCreateTitle: "新建库",
  editorEditTitle: "编辑库",
  save: "保存",
  fields: {
    name: "名称",
    sourcePath: "来源目录",
    sourcePathHint: "新视频到达的位置，例如下载目录或网盘挂载目录。",
    outputPath: "输出目录",
    outputPathHint: "整理好的影片及元数据存放的位置，媒体服务器指向这个目录。",
    placement: "放置方式",
    folderTemplate: "文件夹模板",
    fileTemplate: "文件名模板",
    automation: "自动化",
    discovery: "发现方式",
    cloudPath: "CloudDrive2 路径",
    cloudPathHint: "这个库的根目录在 CloudDrive2 中的路径，例如 /115/Downloads。",
    scanIntervalMinutes: "完整重扫间隔（分钟）",
    scanIntervalHint: "补上变更事件遗漏的文件，例如不发送事件的网络挂载。",
  },
  placements: {
    move: { label: "移动", description: "把视频移动到输出目录，按模板重命名。" },
    hardlink: {
      label: "硬链接",
      description: "在输出目录创建硬链接并保留源文件，种子可以继续做种；两个目录必须在同一卷上。",
    },
    copy: { label: "复制", description: "把视频复制到输出目录并保留源文件。" },
    symlink: { label: "软链接", description: "视频留在原处，在输出目录的元数据旁放一个符号链接。" },
    strm: {
      label: ".strm 链接",
      description:
        "视频留在原处（本地或网盘均可），在输出目录的元数据旁为每个视频写一个指向它的 .strm 文件。媒体服务器需能以与 MDCz 相同的路径访问视频。",
    },
    metadataOnly: {
      label: "仅元数据",
      description: "视频留在原处，只把 NFO 和图片写到输出目录作为归档，媒体服务器无法播放。",
    },
    inPlace: { label: "就地", description: "视频保留原位置和文件名，元数据写在视频旁边，不需要输出目录。" },
  },
  automationLevels: {
    off: { label: "关闭", description: "只处理手动发起的刮削。" },
    register: { label: "仅登记", description: "新文件进入待处理列表，等你手动刮削。" },
    scrape: { label: "登记并刮削", description: "新文件到达完成后立即刮削。" },
  },
  discoveryModes: {
    events: { label: "本地变更事件", description: "监听来源目录的文件系统事件。" },
    clouddrive: {
      label: "CloudDrive2 Webhook",
      description: "由 CloudDrive2 把变更通知给 MDCz；在其文件系统监控中设置向下方 Webhook 发送 POST。",
    },
  },
  baselineNotice: "首次开启自动化时，来源目录中已有的文件只会被记录、不会刮削；请在工作台中手动刮削它们。",
  issues: {
    libraryPathNotAbsolute: "请输入绝对路径",
    libraryOutputRequired: "这种放置方式需要输出目录",
    libraryOutputOverlapsSource: "输出目录不能位于来源目录内，也不能包含来源目录",
    libraryCloudPathInvalid: "请输入以 / 开头的 CloudDrive2 库根路径",
    optionalSegmentPathSeparator: "[] 可选段不能包含路径分隔符",
  },
  card: {
    source: "来源",
    output: "输出",
    noOutput: "视频旁边",
    automationOff: "手动",
    cloudDriveLastEvent: (time) =>
      time
        ? `该媒体库最近一次收到 CloudDrive2 事件：${time}`
        : "MDCz 启动以来该媒体库尚未收到 CloudDrive2 事件，请检查 Webhook 和云端路径。",
  },
  stubSourceHint:
    "来源目录中有 .strm 文件。建议选择「就地」：元数据写在每个 .strm 旁边，.strm 文件也留在 STRM 助手预期的位置。",
};
