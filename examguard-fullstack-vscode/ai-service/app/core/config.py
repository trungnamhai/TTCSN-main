import os

class Settings:
    PROJECT_NAME: str = "ExamGuard AI Proctoring Service"
    VERSION: str = "1.0.0"
    EUCLIDEAN_THRESHOLD: float = float(os.getenv("EUCLIDEAN_THRESHOLD", "0.45"))

settings = Settings()
