import hashlib
import json
from .config import ROOT


class KnowledgeBase:
    def __init__(self):
        self.data = json.loads((ROOT / "data/kb/corpus.json").read_text())
        self.documents = {d["id"]: d for d in self.data["documents"]}
        self.chunks = {
            c["id"]: {**c, "source_id": d["id"]}
            for d in self.documents.values()
            for c in d["chunks"]
        }
        self.version = self.data["version"]
        for d in self.documents.values():
            if hashlib.sha256(d["text"].encode()).hexdigest() != d["sha256"]:
                raise ValueError("KB integrity check failed")

    def context(self):
        return {
            "version": self.version,
            "documents": [
                {
                    "id": d["id"],
                    "title": d["title"],
                    "chunks": d["chunks"],
                    "quality_annotations": d["issues"],
                }
                for d in self.documents.values()
            ],
        }

    def manifest(self):
        return {
            "version": self.version,
            "rules_version": "hard-rules-v1",
            "extraction": self.data["extraction"],
            "sources": [
                {
                    "id": d["id"],
                    "title": d["title"],
                    "url": d["url"],
                    "sha256": d["sha256"],
                    "fetched_at": d["fetched_at"],
                    "issues": d["issues"],
                    "chunks": len(d["chunks"]),
                }
                for d in self.documents.values()
            ],
        }

    def find_claim(self, source_id, needle, text):
        for c in self.documents[source_id]["chunks"]:
            if " ".join(needle.split()) in " ".join(c["text"].split()):
                return {
                    "text": text,
                    "source_id": source_id,
                    "chunk_id": c["id"],
                    "evidence": needle,
                }
        raise ValueError("Expected evidence absent from snapshot")
