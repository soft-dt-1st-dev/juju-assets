# 寿樹様LINE予約受付アプリ　運用環境資産
寿樹様LINE予約受付アプリの運用環境資産です。  
コンテナ資産（docker-compose）、SSL証明書、bot資産（Google Apps Script）が含まれます。
構築手順については、LINEアプリ_環境設定.xlsxをご参照ください。  

### 本リポジトリの資産構成
***
```
LINEアプリ_環境設定.xlsx
README.md

bot（bot資産）
 │  resevation_bot.js
 │  仮予約状況_template.xlsx
 │
 └─bk
      resevation_bot-20230512.js
www（コンテナ資産）
 │  .env.production
 │  docker-compose.yml
 │
 └─nginx
     └─conf.d
         default.conf
         default.conf.init
```
