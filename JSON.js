{
  "id": "exo_tactique_01",
  "difficulty": 2,
  "mode": "TACTIQUE",
  "setup": {
    "incomingShot": {
      "type": "CLEAR",
      "start": {"x": 0.5, "y": 0.9}, 
      "end": {"x": 0.2, "y": 0.1} 
    },
    "players": [
      {"id": "P1_USER", "x": 0.2, "y": 0.1, "role": "RECEIVER"},
      {"id": "P2_PARTNER", "x": 0.6, "y": 0.3, "role": "SUPPORT"},
      {"id": "OPP_1", "x": 0.3, "y": 0.7, "role": "OPPONENT"},
      {"id": "OPP_2", "x": 0.7, "y": 0.8, "role": "OPPONENT"}
    ]
  },
  "objectives": {
    "minScore": 70,
    "timeLimit": 5000
  }
}