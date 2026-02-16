import sys
from pathlib import Path

try:
    from docx import Document
except ImportError:  # pragma: no cover - dependency bootstrap
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-docx"])
    from docx import Document  # type: ignore


def main() -> int:
    """
    Extracts and prints text content from the Coupa Contract Integration DOCX.
    Usage:
        python docs/extract_coupa_contract_doc.py [optional_path]
    """
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
    else:
        path = Path("docs") / "INT.01.04.01 - Coupa Contract Integration ver 0.3.docx"

    if not path.exists():
        print(f"FILE_NOT_FOUND: {path}", file=sys.stderr)
        return 1

    doc = Document(str(path))

    encoding = sys.stdout.encoding or "utf-8"

    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            # Safely handle characters not supported by the active console encoding
            safe = text.encode(encoding, errors="replace").decode(encoding, errors="replace")
            print(safe)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


