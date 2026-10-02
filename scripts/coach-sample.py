# Runs the live coach on 8 household combinations and prints each introduction next to the
# planner's facts, for reading by a human (the automated guardrail tests are in cloud/test).
import json, time, urllib.request
B = "https://everybody-moves.meshulam791.workers.dev"
def req(path, body=None):
    r = urllib.request.Request(B + path, data=None if body is None else json.dumps(body).encode(),
        headers={"content-type": "application/json", "user-agent": "everybody-moves-tests"}, method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(r, timeout=40))
COMBOS = [
    [("Maya", 3, ["knees"]), ("Ben", 4, []), ("Lily", 5, []), ("Grandpa Joe", 2, ["back"])],
    [("Maya", None, None)],
    [("Ben", 2, []), ("Lily", 4, [])],
    [("Grandpa Joe", 3, ["wrists"]), ("Lily", 5, [])],
    [("Maya", 1, []), ("Ben", 1, []), ("Lily", 2, []), ("Grandpa Joe", 2, [])],
    [("Ben", None, None), ("Lily", None, None), ("Grandpa Joe", None, None)],
    [("Maya", 4, ["shoulders", "knees"])],
    [("Maya", 5, []), ("Ben", 5, []), ("Lily", 5, []), ("Grandpa Joe", 5, [])],
    [("Maya", 1, ["knees"]), ("Ben", 4, []), ("Lily", 5, []), ("Grandpa Joe", 3, [])],
]
for c in COMBOS:
    hid = req("/api/demo", {})["hid"]; code = req("/api/session/new", {"hid": hid})["code"]
    ms = {m["name"]: m["id"] for m in req(f"/api/session/{code}")["members"]}
    for name, e, sore in c:
        req(f"/api/session/{code}/present", {"member": ms[name]}) if e is None else req(f"/api/session/{code}/checkin", {"member": ms[name], "energy": e, "sore": sore})
    t = time.time(); d = req(f"/api/session/{code}/plan", {})
    print(f"{time.time() - t:4.1f}s {d['coach']['source']:8} | {d['coach']['text']}\n   facts: {d['plan']['notes']}\n")
