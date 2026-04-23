import os
import glob
from pathlib import Path

def main():
    try:
        from rembg import remove
        from PIL import Image
    except ImportError:
        print("【錯誤】缺少必要的函式庫 (包含 AI 運算核心)！")
        print("請先開啟目錄下的終端機 (或命令提示字元) 並輸入以下指令安裝：")
        print("pip install \"rembg[cpu]\" pillow\n")
        input("按 Enter 鍵結束...")
        return

    # 取得當前腳本所在的資料夾路徑 (也就是圖片所在的資料夾)
    current_dir = Path(__file__).parent.absolute()
    
    print(f"正在搜尋資料夾: {current_dir}")
    print("目標: 將尚未去背的 PNG 檔案進行智能去背...\n")
    
    # 找出所有 png 圖片
    search_pattern = os.path.join(current_dir, "*.png")
    all_pngs = glob.glob(search_pattern)
    
    # 過濾出不需要去背的圖片 (例如已經去背過的、或背景圖)
    # 我們排除包含 '_rmbg' 後綴的檔案，以及預設背景圖片
    target_files = []
    for fp in all_pngs:
        filename = os.path.basename(fp)
        if '_原始' in filename:
            continue
        # 如果是背景或關卡圖 (沒有主體) 不去背
        if 'game_background' in filename or 'main_menu_bg' in filename or 'stage_' in filename:
            continue
        
        target_files.append(fp)

    if not target_files:
        print("沒有找到需要去背的角色/怪物/塔防圖片！(原圖皆已備份)")
        input("按 Enter 鍵結束...")
        return

    print(f"共找到 {len(target_files)} 張需要去背的目標圖片，開始處理...\n")
    print("第一次執行時，rembg 會自動下載 u2net 模型 (大約 170MB)，請耐心等候幾分鐘。")

    for file_path in target_files:
        filename = os.path.basename(file_path)
        name, ext = os.path.splitext(filename)
        
        # 定義備份用的原始檔名 (例如 123_原始.png)
        backup_path = os.path.join(current_dir, f"{name}_原始.png")
        
        # 如果原始備份已經存在，則視為已去背過而跳過
        if os.path.exists(backup_path):
            print(f"[*] 已跳過: {filename} (去背檔案已存在)")
            continue
            
        print(f"[>>] 正在去背: {filename} ... ", end="", flush=True)
        try:
            # 讀取圖片進行去背
            input_image = Image.open(file_path)
            output_image = remove(input_image)
            
            # 將原先未去背的檔案更名為 "原始" 備份
            # 關閉 input_image 資源以避免 Windows 鎖定檔案無法改名
            input_image.close()
            os.rename(file_path, backup_path)
            
            # 直接將去背後的結果存成原原本本的檔名
            output_image.save(file_path)
            
            print("成功！")
        except Exception as e:
            print(f"\n[!!] 處理失敗: {e}")

    print("\n去背作業大功告成！原圖片已備份為 '*_原始.png'，而去背後的乾淨結果直接套用了原本的好名稱！")
    input("按 Enter 鍵結束...")

if __name__ == '__main__':
    main()
