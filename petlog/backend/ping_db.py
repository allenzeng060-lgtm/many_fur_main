import socket
import os
import re
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load env variables
load_dotenv()

def check_connection(host, port, label):
    print(f"\n--- Testing {label} ({host}:{port}) ---")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5) # 5 seconds timeout
    try:
        result = s.connect_ex((host, int(port)))
        if result == 0:
            print(f"✅ SUCCESS: Connection established to {host}:{port}")
            return True
        else:
            print(f"❌ FAILURE: Connection failed to {host}:{port}")
            print(f"   Error Code: {result}")
            if result == 10061: # WSAECONNREFUSED
                print("   Analysis: Connection Refused. The server is reachable but not listening on this port.")
                print("             Likely cause: Service not running or wrong port.")
            elif result == 10060: # WSAETIMEDOUT
                print("   Analysis: Connection Timed Out.")
                print("             Likely cause: Firewall blocking, wrong IP address, or server down.")
            else:
                print(f"   Analysis: Generic network error {result}.")
            return False
    except Exception as e:
        print(f"❌ ERROR: Exception occurred: {e}")
        return False
    finally:
        s.close()

import sys

def main():
    print("=== Database Connection Diagnosis Tool ===")
    
    # 1. Test Local Port 9527
    check_connection("127.0.0.1", 9527, "Local Port 9527 (Possible Forwarding)")
    check_connection("127.0.0.1", 5432, "Local Port 5432 (Default PostgreSQL)")

    # 2. Test Zeabur Cloud Address
    zeabur_host = None
    zeabur_port = 5432

    # Check command line args: python ping_db.py [host] [port]
    if len(sys.argv) > 1:
        zeabur_host = sys.argv[1]
        if len(sys.argv) > 2:
            zeabur_port = int(sys.argv[2])
    else:
        # Check env
        current_url = os.getenv("DATABASE_URL")
        if current_url and "postgresql" in current_url:
             try:
                parsed = urlparse(current_url)
                zeabur_host = parsed.hostname
                zeabur_port = parsed.port or 5432
                print(f"\nFound configured DB Host in .env: {zeabur_host}:{zeabur_port}")
             except:
                pass

    if zeabur_host:
        check_connection(zeabur_host, zeabur_port, "Zeabur Cloud DB")
    else:
        print("\n⚠️ No Zeabur host provided. Run with: python ping_db.py <host> <port>")


if __name__ == "__main__":
    main()
