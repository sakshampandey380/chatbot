import os
import socket
import sys
import uvicorn

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    local_ip = get_local_ip()
    print("\n" + "=" * 56)
    print("  [PolyChat 3D] AI Server Starting...")
    print(f"  Local PC URL   : http://127.0.0.1:{port}/")
    print(f"  Mobile LAN URL : http://{local_ip}:{port}/")
    print("=" * 56 + "\n")
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=False,
    )


