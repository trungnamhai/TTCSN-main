from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.face_service import face_service

router = APIRouter()

class AnalyzeFrameRequest(BaseModel):
    image_base64: Optional[str] = None
    simulated_face_count: Optional[int] = None
    registered_embedding: Optional[str] = None
    student_code: Optional[str] = None
    session_code: Optional[str] = None

@router.get("/health")
def health_check():
    return {
        "service": "ExamGuard FastAPI OpenCV Service",
        "status": "ONLINE",
        "opencv_ready": True
    }

@router.post("/verify-face")
def verify_face(payload: AnalyzeFrameRequest):
    return face_service.analyze_frame(
        image_base64=payload.image_base64,
        simulated_face_count=payload.simulated_face_count,
        registered_embedding=payload.registered_embedding
    )

@router.post("/proctor-frame")
def proctor_frame(payload: AnalyzeFrameRequest):
    return face_service.analyze_frame(
        image_base64=payload.image_base64,
        simulated_face_count=payload.simulated_face_count,
        registered_embedding=payload.registered_embedding
    )
