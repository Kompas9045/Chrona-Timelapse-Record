# Chrona - 延時屏幕錄影工具

[![github](https://img.shields.io/badge/License-AGPLv3-orange.svg)](https://www.gnu.org/licenses/agpl-3.0.html)
[![github](https://img.shields.io/badge/Developer-Kompas9045-blue.svg)](https://github.com/Kompas9045)

Chrona 是一個基於 WebRTC 和 WebCodecs API 的延時屏幕錄影工具，允許用戶在瀏覽器中錄製屏幕或攝像頭，並將其保存為視頻文件。

這個工程是我在 **VIRTUAL AND AUGMENTED REALITY（虛擬與擴增實境） - 2509-BADZ12D1** 課程的附屬工具，用於記錄和保存延時視頻。

感謝 VIRTUAL AND AUGMENTED REALITY 課程的老師和助教，為我提供了寶貴的學習機會。

這個工程的網站備案尚未完成，暫不提供在線訪問，但是您可以在本地運行該項目，您可以訪問本頁的 [releases](https://github.com/Kompas9045/Chrona-Timelapse-Record/releases) 頁面獲取含服務器的編譯版本。

如果這個項目對您有用，請不要吝嗇您的 star。

## 功能特點

- 支持屏幕和攝像頭錄製
- 延時錄製（可調節採樣間隔）
- 多種輸出格式：WebM 和 MP4
- 多種幀捕獲模式：
  - 壓縮模式 (WebP)
  - 無損 PNG 模式
  - 原始 ImageBitmap 模式（最高質量）
- 完全在瀏覽器中運行，無需下載（需要等待網站備案，普通用戶請暫時使用構建版本）

## 技術棧

- [React](https://reactjs.org/) - 用於構建用戶界面
- [Vite](https://vitejs.dev/) - 快速的開發構建工具
- [TypeScript](https://www.typescriptlang.org/) - JavaScript 的超集，提供類型安全
- [Mediabunny](https://mediabunny.dev/) - 用於 WebCodecs 編碼和復用
- [WebRTC](https://webrtc.org/) - 用於媒體捕獲
- [WebCodecs API](https://w3c.github.io/webcodecs/) - 用於高效媒體編碼

## 安裝和運行（適用於開發者，普通用戶請直接下載 releases 中的版本）

1. 克隆倉庫：

   ```
   git clone <repository-url>
   cd Chrona-Timelapse-Record
   ```

2. 安裝依賴：

   ```
   npm install
   ```

3. 補充根據 EULA 不予包含的字體文件

   請向 public 目錄補充 Garet-Book.woff2 字體文件，Garet 字體可以在 Type-Forward 字體庫中或[這裡](https://www.dafont.com/garet.font)免費下載。

4. 啟動開發服務器：

   ```
   npm run dev
   ```

5. 構建生產版本：

   ```
   npm run build
   ```

## 使用說明

1. 選擇錄製源（攝像頭或屏幕）
2. 點擊「獲取媒體」按鈕
3. 調整錄製參數（分辨率、採樣間隔、輸出 FPS 等）
4. 點擊「開始錄製」
5. 錄製完成後點擊「停止錄製」
6. 點擊「下載視頻」保存錄製結果

> **注意**：Chrona 需要現代化的瀏覽器以工作，建議使用最新版本的 Chrome、Firefox 或 Microsoft Edge 瀏覽器。
>
> 值得注意的是，本人在 Android 上測試時，Chrona 無法使用屏幕錄製，但是可以使用攝像頭進行錄製。

### 參數說明

- **分辨率**：錄製視頻的寬度和高度
- **採樣間隔**：每隔多少毫秒捕獲一幀（控制時間流逝速度）
- **輸出 FPS**：最終視頻的播放幀率
- **最大幀數**：限制錄製的總幀數以控制內存使用
- **採樣質量**：影響壓縮質量和碼率計算
- **幀模式**：決定如何捕獲和存儲幀數據
- **目標碼率**：視頻編碼的目標比特率（kbps）（這個值會自動使用基於多個視頻網站的推薦算法計算出，但是也可以在最後手動設置）

## 許可證

本軟件遵循 AGPLv3 許可證。有關詳細信息，請參閱 LICENSE 文件。

注意：本人不以任何明示或暗示的方式就本產品的功能、適銷性或特定用途的適用性作出任何保證或承諾。本產品係依「現況」提供，不提供任何形式的擔保。在任何情況下，作者或版權持有者均不對因使用本軟體而產生的任何索賠、損害或其他責任承擔責任，無論是在合同訴訟、侵權行為或其他方面。

第三方組件及其許可證：
- Mediabunny - Mozilla Public License 2.0
- React - MIT License
- Vite - MIT License
- WebCodecs - W3C 規範
- Garet - Type-Forward_FreeGaret_EULA

## 開發者

[Kompas9045](https://github.com/Kompas9045)
