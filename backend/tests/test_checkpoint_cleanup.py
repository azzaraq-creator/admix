from src.services.graph.checkpoint_cleanup import delete_checkpoints_for_thread


class FakeResult:
    rowcount = 3


class FakeSession:
    def __init__(self):
        self.sql = []
        self.params = []
        self.committed = False

    def execute(self, stmt, params=None):
        self.sql.append(str(stmt))
        self.params.append(params)
        return FakeResult()

    def commit(self):
        self.committed = True


def test_delete_checkpoints_for_thread_targets_only_thread_tables():
    db = FakeSession()
    counts = delete_checkpoints_for_thread(db, "thread-123")

    assert counts == {
        "checkpoint_writes": 3,
        "checkpoint_blobs": 3,
        "checkpoints": 3,
    }
    joined = "\n".join(db.sql)
    assert "checkpoint_writes" in joined
    assert "checkpoint_blobs" in joined
    assert "checkpoints" in joined
    assert "checkpoint_migrations" not in joined
    assert all(p == {"thread_id": "thread-123"} for p in db.params)
    assert db.committed is False


def test_delete_checkpoints_for_thread_noops_empty_thread_id():
    db = FakeSession()
    counts = delete_checkpoints_for_thread(db, "")

    assert counts == {
        "checkpoint_writes": 0,
        "checkpoint_blobs": 0,
        "checkpoints": 0,
    }
    assert db.sql == []
    assert db.committed is False
