Set WshShell = CreateObject("WScript.Shell")
' 使用绝对路径直接运行Node.js脚本，0表示隐藏窗口
WshShell.Run "node ""E:\webAskAi\port-way\local-ai-server.js""", 0