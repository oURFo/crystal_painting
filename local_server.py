import http.server
import socketserver
import webbrowser

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler
# 確保 JS 模組的 MIME Type 正確
Handler.extensions_map.update({
    '.js': 'application/javascript',
})

print(f"正在啟動伺服器：http://localhost:{PORT}")
print("按下 Ctrl+C 可停止伺服器")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    webbrowser.open(f"http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已停止")
        httpd.shutdown()
