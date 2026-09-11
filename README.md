# 我的账本 · 个人消费记录

Flask + MySQL + React 的个人记账应用。

## 功能
- 登录/注册(多用户数据隔离)
- 记账:支出/收入双分类、备注、按月浏览、编辑删除
- 预算:月度总预算 + 分类预算,进度条超支提醒
- 统计:分类占比饼图、每日趋势折线图、分类排行

## 技术栈
- 后端:Flask + PyMySQL(MySQL)
- 前端:Vite + React 18 + ECharts + Bootstrap 5

## 本地运行
```bash
# 1. 后端
cd backend
cp config.example.py config.py   # 填入你的 MySQL 密码
pip install -r requirements.txt
python app.py                    # 自动建库建表,监听 5000

# 2. 前端
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

## 目录结构
```
backend/    Flask API + MySQL
frontend/   React 前端
```
