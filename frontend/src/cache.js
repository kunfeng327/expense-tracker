// 极简内存缓存:切页再回来先秒显上次数据,后台再拉最新(stale-while-revalidate)
// 模块级 Map,组件卸载不销毁;退出登录时记得 clearCache(),防止下个账号看到旧数据
const store = new Map()

export const getCache = k => store.get(k)
export const setCache = (k, v) => store.set(k, v)
export const clearCache = () => store.clear()
