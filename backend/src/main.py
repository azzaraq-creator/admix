from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.database import Base, engine
from src.routers.admin import router as admin_router
from src.routers.admin_auth import router as admin_auth_router
from src.routers.auth import router as auth_router
from src.routers.chat_graph import router as chat_graph_router
from src.routers.faq import router as faq_router
from src.routers.media import router as media_router
from src.routers.oauth import router as oauth_router
from src.routers.recommend_v2 import router as recommend_v2_router
from src.services.graph.builder import build_graph
from src.services.graph.checkpointer import open_checkpointer

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 모델 메타데이터 등록을 보장하기 위해 import (B 구조 들어가면 추가).
    import src.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    async with open_checkpointer() as checkpointer:
        app.state.graph = build_graph(
            rerank="sangwon",
            explain=True,
            checkpointer=checkpointer,
        )
        yield


app = FastAPI(
    title="ooh-recommend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/swagger",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(faq_router)
app.include_router(media_router)
app.include_router(admin_router)
app.include_router(admin_auth_router)
app.include_router(chat_graph_router)
app.include_router(recommend_v2_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=True)
