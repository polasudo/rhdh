#
#
# Copyright Red Hat
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Utility script for inspecting RAG vector database contents."""

import argparse
import json
import logging
import os
import sqlite3
import sys
from typing import Any

import yaml


def get_llamastack_faiss_data(db_path: str) -> dict[str, Any]:
    """Get all data from llamastack-faiss SQLite database."""
    db_file = os.path.join(db_path, "faiss_store.db")
    if not os.path.exists(db_file):
        return {"error": f"Database file not found: {db_file}"}
    
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    result: dict[str, Any] = {}
    
    try:
        cursor.execute("SELECT key, value FROM kvstore WHERE key LIKE '%faiss_index%';")
        row = cursor.fetchone()
        
        if row:
            key, value = row
            data = json.loads(value)
            
            chunk_by_index = data.get("chunk_by_index", {})
            result["total_chunks"] = len(chunk_by_index)
            
            chunks = []
            total_text_length = 0
            min_chunk_length = float('inf')
            max_chunk_length = 0
            
            for idx in sorted(chunk_by_index.keys(), key=int):
                chunk_str = chunk_by_index[idx]
                try:
                    chunk_data = json.loads(chunk_str)
                    content = chunk_data.get("content", "")
                    metadata = {k: v for k, v in chunk_data.items() if k != "content"}
                    
                    text_len = len(content)
                    total_text_length += text_len
                    min_chunk_length = min(min_chunk_length, text_len)
                    max_chunk_length = max(max_chunk_length, text_len)
                    
                    chunks.append({
                        "index": int(idx),
                        "content": content,
                        "metadata": metadata,
                        "content_length": text_len,
                    })
                except json.JSONDecodeError:
                    chunks.append({
                        "index": int(idx),
                        "content": chunk_str,
                        "metadata": {},
                        "content_length": len(chunk_str),
                    })
            
            result["chunks"] = chunks
            result["text_stats"] = {
                "total_characters": total_text_length,
                "avg_chunk_length": round(total_text_length / len(chunks), 2) if chunks else 0,
                "min_chunk_length": min_chunk_length if min_chunk_length != float('inf') else 0,
                "max_chunk_length": max_chunk_length,
            }
            
            faiss_index_b64 = data.get("faiss_index", "")
            result["faiss_index_size_chars"] = len(faiss_index_b64)
        
        cursor.execute("SELECT value FROM kvstore WHERE key LIKE '%vector_dbs%';")
        vdb_row = cursor.fetchone()
        if vdb_row:
            result["vector_db_info"] = json.loads(vdb_row[0])
        
        cursor.execute("SELECT value FROM kvstore WHERE key LIKE '%openai_vector_stores%';")
        ovs_row = cursor.fetchone()
        if ovs_row:
            result["openai_vector_store_info"] = json.loads(ovs_row[0])
            
    except Exception as e:
        result["error"] = str(e)
    finally:
        conn.close()
    
    return result


def get_metadata_from_file(db_path: str) -> dict[str, Any] | None:
    """Read metadata.json if it exists."""
    metadata_file = os.path.join(db_path, "metadata.json")
    if os.path.exists(metadata_file):
        with open(metadata_file, "r") as f:
            return json.load(f)
    return None


def get_llama_stack_config(db_path: str) -> dict[str, Any] | None:
    """Read llama-stack.yaml if it exists."""
    config_file = os.path.join(db_path, "llama-stack.yaml")
    if os.path.exists(config_file):
        with open(config_file, "r") as f:
            return yaml.safe_load(f)
    return None


def detect_vector_store_type(db_path: str) -> str:
    """Auto-detect the vector store type based on files present."""
    if os.path.exists(os.path.join(db_path, "metadata.json")):
        return "faiss"
    elif os.path.exists(os.path.join(db_path, "sqlite-vec_store.db")):
        return "llamastack-sqlite-vec"
    elif os.path.exists(os.path.join(db_path, "faiss_store.db")):
        return "llamastack-faiss"
    else:
        return "unknown"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect RAG vector database contents and statistics"
    )
    parser.add_argument(
        "-p", "--db-path",
        required=True,
        help="Path to the vector database directory",
    )
    parser.add_argument(
        "--list-chunks",
        action="store_true",
        help="List all chunks with their content",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output all results in JSON format",
    )
    parser.add_argument(
        "--vector-store-type",
        default="auto",
        choices=["auto", "faiss", "llamastack-faiss", "llamastack-sqlite-vec"],
        help="Vector store type (default: auto-detect)",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=0,
        help="Show N sample chunks (0 = none, use with human-readable output)",
    )
    
    args = parser.parse_args()
    
    if args.json:
        logging.basicConfig(
            level=logging.ERROR,
            format="%(levelname)s: %(message)s",
            stream=sys.stderr,
        )
    else:
        logging.basicConfig(level=logging.INFO, format="%(message)s")
    
    if args.vector_store_type == "auto":
        args.vector_store_type = detect_vector_store_type(args.db_path)
        if not args.json:
            logging.info(f"Detected vector store type: {args.vector_store_type}")
    
    output: dict[str, Any] = {
        "db_path": os.path.abspath(args.db_path),
        "vector_store_type": args.vector_store_type,
    }
    
    file_metadata = get_metadata_from_file(args.db_path)
    if file_metadata:
        output["build_metadata"] = file_metadata
    
    llama_stack_config = get_llama_stack_config(args.db_path)
    if llama_stack_config:
        output["llama_stack_config"] = {
            "models": llama_stack_config.get("models", []),
            "vector_dbs": llama_stack_config.get("vector_dbs", []),
        }
    
    if os.path.isdir(args.db_path):
        output["db_files"] = sorted(os.listdir(args.db_path))
    
    if args.vector_store_type in ("llamastack-faiss", "llamastack-sqlite-vec"):
        db_data = get_llamastack_faiss_data(args.db_path)
        
        output["total_chunks"] = db_data.get("total_chunks", 0)
        output["text_stats"] = db_data.get("text_stats", {})
        output["faiss_index_size_chars"] = db_data.get("faiss_index_size_chars", 0)
        
        if "vector_db_info" in db_data:
            output["vector_db_info"] = db_data["vector_db_info"]
        
        if args.list_chunks and "chunks" in db_data:
            output["chunks"] = db_data["chunks"]
        elif args.sample > 0 and "chunks" in db_data:
            output["sample_chunks"] = db_data["chunks"][:args.sample]
        
        if "error" in db_data:
            output["error"] = db_data["error"]
    
    elif args.vector_store_type == "faiss":
        output["note"] = "Standard FAISS format - use llama_index to load"
    
    if args.json:
        if not args.list_chunks and "chunks" in output:
            del output["chunks"]
        print(json.dumps(output, indent=2, default=str))
    else:
        print("=" * 80)
        print("VECTOR DATABASE INSPECTION REPORT")
        print("=" * 80)
        print(f"\nDatabase Path: {output['db_path']}")
        print(f"Vector Store Type: {output['vector_store_type']}")
        
        if "db_files" in output:
            print(f"\nFiles in database directory:")
            for f in output["db_files"]:
                print(f"  - {f}")
        
        if "llama_stack_config" in output:
            print(f"\n--- Llama Stack Configuration ---")
            if output["llama_stack_config"]["models"]:
                print("  Models:")
                for model in output["llama_stack_config"]["models"]:
                    print(f"    - {model.get('model_id', 'N/A')}")
                    print(f"      Dimension: {model.get('metadata', {}).get('embedding_dimension', 'N/A')}")
            if output["llama_stack_config"]["vector_dbs"]:
                print("  Vector DBs:")
                for vdb in output["llama_stack_config"]["vector_dbs"]:
                    print(f"    - ID: {vdb.get('vector_db_id', 'N/A')}")
        
        print(f"\n--- Statistics ---")
        print(f"  Total Chunks: {output.get('total_chunks', 'N/A')}")
        
        if "text_stats" in output:
            ts = output["text_stats"]
            print(f"\n--- Text Statistics ---")
            print(f"  Total Characters: {ts.get('total_characters', 0):,}")
            print(f"  Avg Chunk Length: {ts.get('avg_chunk_length', 0):.2f} chars")
            print(f"  Min Chunk Length: {ts.get('min_chunk_length', 0)} chars")
            print(f"  Max Chunk Length: {ts.get('max_chunk_length', 0)} chars")
        
        if "faiss_index_size_chars" in output:
            print(f"  FAISS Index Size: {output['faiss_index_size_chars']:,} chars (base64)")
        
        if "error" in output:
            print(f"\n❌ Error: {output['error']}")
        
        if "note" in output:
            print(f"\nℹ️  Note: {output['note']}")
        
        if "sample_chunks" in output:
            print(f"\n--- Sample Chunks ({len(output['sample_chunks'])} shown) ---")
            for chunk in output["sample_chunks"]:
                print(f"\n[Chunk {chunk['index']}] ({chunk['content_length']} chars)")
                print("-" * 40)
                content = chunk['content']
                if len(content) > 500:
                    print(content[:500] + "...")
                else:
                    print(content)
                if chunk.get('metadata'):
                    print(f"Metadata: {chunk['metadata']}")
        
        if args.list_chunks and "chunks" in output:
            print(f"\n--- All Chunks ({len(output['chunks'])} total) ---")
            print(json.dumps(output["chunks"], indent=2, default=str))
        
        print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
