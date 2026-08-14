#!/usr/bin/env python3
"""Set a GitHub Actions secret on the magen-gillan/alisha repo.

Reads the secret value from argv[2], encrypts it with the repo's public key,
and PUTs it to the GitHub API.

Usage:
  GH_PAT=<github_token> python3 set_github_secret.py <SECRET_NAME> <SECRET_VALUE>
"""
import os
import sys
import json
import base64
import urllib.request
from nacl import public

REPO = "magen-gillan/alisha"
PAT = os.environ.get("GH_PAT", "")

if not PAT:
    print("ERROR: GH_PAT env var must be set.")
    sys.exit(1)

def api(method, path, body=None):
    url = f"https://api.github.com/repos/{REPO}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={
        "Authorization": f"token {PAT}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

status, key_resp = api("GET", "actions/secrets/public-key")
if status != 200:
    print("Failed to get public key:", status, key_resp)
    sys.exit(1)

pk = public.PublicKey(base64.b64decode(key_resp["key"]))
sealed = public.SealedBox(pk)

secret_name = sys.argv[1]
secret_value = sys.argv[2]
encrypted = sealed.encrypt(secret_value.encode())

body = {
    "encrypted_value": base64.b64encode(encrypted).decode(),
    "key_id": key_resp["key_id"],
}
status, resp = api("PUT", f"actions/secrets/{secret_name}", body)
print(f"PUT {secret_name}: HTTP {status}")
if status >= 400:
    print(resp)
    sys.exit(2)
print(f"Secret '{secret_name}' set successfully.")
