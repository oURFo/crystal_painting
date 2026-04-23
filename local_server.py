import http.server
import socketserver
import webbrowser

PORT = 8000

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """開發用伺服器：停用所有快取，確保每次請求都取得最新檔案"""

    def end_headers(self):
        # 停用瀏覽器快取
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# 確保 JS 模組的 MIME Type 正確
NoCacheHandler.extensions_map.update({
    '.js': 'application/javascript',
})

print(f"正在啟動伺服器：http://localhost:{PORT}")
print("按下 Ctrl+C 可停止伺服器")

with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    webbrowser.open(f"http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已停止")
        httpd.shutdown()
