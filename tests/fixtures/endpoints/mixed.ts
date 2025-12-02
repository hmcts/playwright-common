// Mixed static and dynamic calls; dynamic should be ignored by AST scanner
client.get(`/dynamic/${"id"}`); // template with interpolation (skip)
client.put("/update" + "Suffix"); // concatenation (skip)
client.get("/info"); // static (detect)
apiClient.delete("/archive/456"); // static (detect)