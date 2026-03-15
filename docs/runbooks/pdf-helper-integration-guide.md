# PDF Helper Project Integration Guide (Option B: Automated)

## Absolute Paths for Helper Project

### Input Paths (Read-Only)

```python
# PDF Index Files (processed chunks with embeddings)
PDF_INDEX_DIR = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/dist/pdf-index"
PDF_CHUNKS_FILE = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/dist/pdf-index/chunks.json"
PDF_MANIFEST_FILE = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/dist/pdf-index/manifest.json"
PDF_INDEX_FILE = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/dist/pdf-index/index.json"

# Concept Registry (source of truth for concept IDs)
CONCEPT_REGISTRY_FILE = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/src/app/data/concept-registry.json"

# Raw PDF Source (if needed for OCR/page images)
RAW_PDF_FILE = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/textbooks/murachs-mysql-3rd-edition.pdf"
```

### Output Paths (Write Here)

```python
# Generated Concept Markdown Files
OUTPUT_CONCEPTS_DIR = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/public/textbook-static/concepts"

# Generated Concept Map
OUTPUT_CONCEPT_MAP = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/public/textbook-static/concept-map.json"
```

---

## Complete Helper Project Script Template

Save this as `generate_concepts.py` in your helper project:

```python
#!/usr/bin/env python3
"""
PDF Concept Generator for SQL-Adapt

Reads processed PDF chunks and generates structured concept markdown files.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

# ============================================
# CONFIGURATION - Absolute Paths
# ============================================

# Input paths (read from SQL-Adapt project)
SQL_ADAPT_ROOT = "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts"
PDF_INDEX_DIR = f"{SQL_ADAPT_ROOT}/dist/pdf-index"
PDF_CHUNKS_FILE = f"{PDF_INDEX_DIR}/chunks.json"
PDF_MANIFEST_FILE = f"{PDF_INDEX_DIR}/manifest.json"
CONCEPT_REGISTRY_FILE = f"{SQL_ADAPT_ROOT}/apps/web/src/app/data/concept-registry.json"

# Output paths (write to SQL-Adapt project)
OUTPUT_DIR = f"{SQL_ADAPT_ROOT}/apps/web/public/textbook-static"
OUTPUT_CONCEPTS_DIR = f"{OUTPUT_DIR}/concepts"
OUTPUT_CONCEPT_MAP = f"{OUTPUT_DIR}/concept-map.json"

# ============================================
# DATA MODELS
# ============================================

class PdfChunk:
    """Represents a chunk from the PDF index"""
    def __init__(self, data: dict):
        self.chunk_id = data["chunkId"]
        self.doc_id = data["docId"]
        self.page = data["page"]
        self.text = data["text"]
        self.embedding = data.get("embedding", [])
    
    def __repr__(self):
        return f"PdfChunk({self.chunk_id}, page={self.page})"

class ConceptInfo:
    """Concept information from registry"""
    def __init__(self, concept_id: str, data: dict):
        self.id = concept_id
        self.title = data.get("title", concept_id)
        self.definition = data.get("oneLineDefinition", "")
        self.tags = data.get("tags", [])
        self.difficulty = self._extract_difficulty()
        self.source_refs = data.get("sourceRefs", [])
    
    def _extract_difficulty(self) -> str:
        tags = self.tags
        if "beginner" in tags:
            return "beginner"
        elif "advanced" in tags:
            return "advanced"
        return "intermediate"

# ============================================
# PDF INDEX LOADER
# ============================================

class PdfIndexLoader:
    """Loads and queries the PDF index"""
    
    def __init__(self, chunks_file: str):
        self.chunks: List[PdfChunk] = []
        self.load_chunks(chunks_file)
    
    def load_chunks(self, filepath: str):
        """Load chunks from JSON file"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.chunks = [PdfChunk(c) for c in data]
        print(f"Loaded {len(self.chunks)} chunks from {filepath}")
    
    def get_chunks_by_page(self, page: int) -> List[PdfChunk]:
        """Get all chunks for a specific page"""
        return [c for c in self.chunks if c.page == page]
    
    def get_chunks_by_range(self, start_page: int, end_page: int) -> List[PdfChunk]:
        """Get chunks for a page range"""
        return [c for c in self.chunks if start_page <= c.page <= end_page]
    
    def get_chunk_by_id(self, chunk_id: str) -> Optional[PdfChunk]:
        """Get a specific chunk by ID"""
        for chunk in self.chunks:
            if chunk.chunk_id == chunk_id:
                return chunk
        return None
    
    def search_chunks(self, query: str, top_k: int = 5) -> List[PdfChunk]:
        """Simple keyword search (replace with semantic search if needed)"""
        query_lower = query.lower()
        scored = []
        for chunk in self.chunks:
            text_lower = chunk.text.lower()
            # Simple scoring: count keyword matches
            score = sum(1 for word in query_lower.split() if word in text_lower)
            if score > 0:
                scored.append((score, chunk))
        
        scored.sort(reverse=True, key=lambda x: x[0])
        return [chunk for _, chunk in scored[:top_k]]

# ============================================
# CONCEPT CONTENT GENERATOR
# ============================================

class ConceptContentGenerator:
    """Generates structured markdown content from PDF chunks"""
    
    def __init__(self, pdf_loader: PdfIndexLoader):
        self.pdf_loader = pdf_loader
    
    def generate_concept_markdown(
        self,
        concept: ConceptInfo,
        definition_chunks: List[PdfChunk],
        example_chunks: List[PdfChunk],
        mistake_chunks: List[PdfChunk]
    ) -> str:
        """
        Generate markdown content for a concept.
        
        Args:
            concept: Concept metadata
            definition_chunks: Chunks containing the concept definition
            example_chunks: Chunks containing examples
            mistake_chunks: Chunks containing common mistakes
        
        Returns:
            Structured markdown string
        """
        
        # Extract text from chunks
        definition_text = self._merge_chunks(definition_chunks)
        examples_text = self._merge_chunks(example_chunks)
        mistakes_text = self._merge_chunks(mistake_chunks)
        
        # Get page numbers for citation
        all_pages = sorted(set(
            c.page for c in definition_chunks + example_chunks + mistake_chunks
        ))
        
        # Build markdown
        markdown = f"""# {concept.title}

## Definition
{self._format_definition(definition_text, concept.definition)}

## Explanation
{self._format_explanation(definition_text)}

## Examples
{self._format_examples(examples_text)}

## Common Mistakes
{self._format_mistakes(mistakes_text)}

---
*Source: Murach's MySQL 3rd Edition, Pages {', '.join(map(str, all_pages))}*
"""
        return markdown.strip()
    
    def _merge_chunks(self, chunks: List[PdfChunk]) -> str:
        """Merge multiple chunks into coherent text"""
        if not chunks:
            return ""
        # Sort by page and chunk index
        sorted_chunks = sorted(chunks, key=lambda c: (c.page, c.chunk_id))
        return "\n\n".join(c.text for c in sorted_chunks)
    
    def _format_definition(self, text: str, fallback: str) -> str:
        """Format the definition section"""
        # If text is too long, extract first sentence or use fallback
        if len(text) > 500:
            sentences = text.split('. ')
            return sentences[0] + '.' if sentences else fallback
        return text or fallback
    
    def _format_explanation(self, text: str) -> str:
        """Format the explanation section"""
        if not text:
            return "No detailed explanation available in textbook."
        
        # Clean up and format
        lines = text.split('\n')
        formatted = []
        for line in lines:
            line = line.strip()
            if line and len(line) > 20:  # Skip very short fragments
                formatted.append(line)
        
        return '\n\n'.join(formatted[:5])  # Limit to first 5 paragraphs
    
    def _format_examples(self, text: str) -> str:
        """Format the examples section"""
        if not text:
            return "### Example 1\n```sql\n-- No example available\n```\nNo example available."
        
        # Try to extract SQL code blocks
        examples = self._extract_sql_examples(text)
        if examples:
            return '\n\n'.join(examples)
        
        # Fallback: format as generic example
        return f"### Example 1\n{text[:500]}"
    
    def _extract_sql_examples(self, text: str) -> List[str]:
        """Extract SQL examples from text"""
        examples = []
        
        # Look for SQL patterns
        import re
        sql_patterns = [
            r'(SELECT\s+.+?;)',
            r'(INSERT\s+.+?;)',
            r'(UPDATE\s+.+?;)',
            r'(DELETE\s+.+?;)',
        ]
        
        for i, pattern in enumerate(sql_patterns, 1):
            matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)
            for j, match in enumerate(matches[:2], 1):  # Max 2 per type
                example_num = len(examples) + 1
                examples.append(f"""### Example {example_num}
```sql
{match.strip()}
```
Example from textbook.""")
        
        return examples
    
    def _format_mistakes(self, text: str) -> str:
        """Format the common mistakes section"""
        if not text:
            return "### No common mistakes listed\nNo specific mistakes documented in textbook."
        
        # Try to extract warnings or cautionary text
        mistakes = []
        
        # Look for warning indicators
        warning_phrases = [
            "warning", "caution", "note:", "important", 
            "common error", "mistake", "incorrect", "avoid"
        ]
        
        lines = text.split('\n')
        for line in lines:
            line_lower = line.lower()
            if any(phrase in line_lower for phrase in warning_phrases):
                if len(line) > 30:
                    mistakes.append(line.strip())
        
        if mistakes:
            formatted = []
            for i, mistake in enumerate(mistakes[:3], 1):
                formatted.append(f"""### Mistake {i}
{mistake}

**Why this happens:** This issue is documented in the textbook as a common pitfall.""")
            return '\n\n'.join(formatted)
        
        return f"### Common Issues\n{text[:400]}"

# ============================================
# MAIN GENERATION PIPELINE
# ============================================

def load_concept_registry(filepath: str) -> List[ConceptInfo]:
    """Load concepts from registry"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    concepts = []
    for c in data.get("concepts", []):
        concept_id = c.get("conceptId")
        if concept_id:
            concepts.append(ConceptInfo(concept_id, c))
    
    print(f"Loaded {len(concepts)} concepts from registry")
    return concepts

def map_concepts_to_chunks(
    concepts: List[ConceptInfo],
    pdf_loader: PdfIndexLoader
) -> Dict[str, Dict]:
    """
    Map concepts to PDF chunks.
    
    Strategy:
    1. Use sourceRefs from concept registry if available
    2. Otherwise search for relevant chunks using keywords
    3. Assign chunks to definition/examples/mistakes categories
    """
    concept_chunk_map = {}
    
    for concept in concepts:
        print(f"\nMapping concept: {concept.id}")
        
        definition_chunks = []
        example_chunks = []
        mistake_chunks = []
        page_numbers = []
        
        # Method 1: Use source references if available
        if concept.source_refs:
            for ref in concept.source_refs:
                page = ref.get("page")
                if page:
                    page_chunks = pdf_loader.get_chunks_by_page(page)
                    if page_chunks:
                        definition_chunks.extend(page_chunks)
                        page_numbers.append(page)
        
        # Method 2: Search by keywords if no refs or need more content
        if not definition_chunks:
            search_query = concept.title.replace("-", " ").replace("_", " ")
            found_chunks = pdf_loader.search_chunks(search_query, top_k=5)
            
            # Assign found chunks to categories (simple heuristic)
            for i, chunk in enumerate(found_chunks):
                if i < 2:
                    definition_chunks.append(chunk)
                elif i < 4:
                    example_chunks.append(chunk)
                else:
                    mistake_chunks.append(chunk)
                page_numbers.append(chunk.page)
        
        # Deduplicate and sort
        def dedupe(chunks):
            seen = set()
            result = []
            for c in chunks:
                if c.chunk_id not in seen:
                    seen.add(c.chunk_id)
                    result.append(c)
            return sorted(result, key=lambda x: (x.page, x.chunk_id))
        
        definition_chunks = dedupe(definition_chunks)
        example_chunks = dedupe(example_chunks)
        mistake_chunks = dedupe(mistake_chunks)
        page_numbers = sorted(set(page_numbers))
        
        # Build chunk ID lists for concept map
        concept_chunk_map[concept.id] = {
            "title": concept.title,
            "definition": concept.definition,
            "difficulty": concept.difficulty,
            "pageNumbers": page_numbers,
            "chunkIds": {
                "definition": [c.chunk_id for c in definition_chunks],
                "examples": [c.chunk_id for c in example_chunks],
                "commonMistakes": [c.chunk_id for c in mistake_chunks]
            },
            "relatedConcepts": [],  # Fill based on tags
            "practiceProblemIds": []
        }
        
        # Store chunks for markdown generation
        concept_chunk_map[concept.id]["_chunks"] = {
            "definition": definition_chunks,
            "examples": example_chunks,
            "commonMistakes": mistake_chunks
        }
        
        print(f"  - Definition: {len(definition_chunks)} chunks")
        print(f"  - Examples: {len(example_chunks)} chunks")
        print(f"  - Mistakes: {len(mistake_chunks)} chunks")
        print(f"  - Pages: {page_numbers}")
    
    return concept_chunk_map

def generate_concept_map(concept_chunk_map: Dict) -> dict:
    """Generate the concept-map.json structure"""
    return {
        "version": "1.0.0",
        "generatedAt": "2026-02-25T10:00:00Z",
        "sourceDocId": "murachs-mysql-3rd-edition",
        "concepts": {
            k: {
                "title": v["title"],
                "definition": v["definition"],
                "difficulty": v["difficulty"],
                "pageNumbers": v["pageNumbers"],
                "chunkIds": v["chunkIds"],
                "relatedConcepts": v.get("relatedConcepts", []),
                "practiceProblemIds": v.get("practiceProblemIds", [])
            }
            for k, v in concept_chunk_map.items()
        }
    }

def generate_markdown_files(
    concept_chunk_map: Dict,
    generator: ConceptContentGenerator,
    output_dir: str
):
    """Generate all concept markdown files"""
    os.makedirs(output_dir, exist_ok=True)
    
    for concept_id, data in concept_chunk_map.items():
        print(f"\nGenerating markdown for: {concept_id}")
        
        # Create ConceptInfo
        concept = ConceptInfo(concept_id, {
            "title": data["title"],
            "oneLineDefinition": data["definition"],
            "tags": []
        })
        
        # Get chunks
        chunks = data.get("_chunks", {})
        
        # Generate markdown
        markdown = generator.generate_concept_markdown(
            concept=concept,
            definition_chunks=chunks.get("definition", []),
            example_chunks=chunks.get("examples", []),
            mistake_chunks=chunks.get("commonMistakes", [])
        )
        
        # Write file
        output_file = os.path.join(output_dir, f"{concept_id}.md")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        print(f"  ✓ Written: {output_file}")

# ============================================
# MAIN ENTRY POINT
# ============================================

def main():
    """Main generation pipeline"""
    print("=" * 60)
    print("PDF Concept Generator for SQL-Adapt")
    print("=" * 60)
    
    # Step 1: Load PDF index
    print("\n[1/4] Loading PDF index...")
    pdf_loader = PdfIndexLoader(PDF_CHUNKS_FILE)
    
    # Step 2: Load concept registry
    print("\n[2/4] Loading concept registry...")
    concepts = load_concept_registry(CONCEPT_REGISTRY_FILE)
    
    # Step 3: Map concepts to chunks
    print("\n[3/4] Mapping concepts to PDF chunks...")
    concept_chunk_map = map_concepts_to_chunks(concepts, pdf_loader)
    
    # Step 4: Generate concept map
    print("\n[4/4] Generating concept map...")
    concept_map = generate_concept_map(concept_chunk_map)
    
    with open(OUTPUT_CONCEPT_MAP, 'w', encoding='utf-8') as f:
        json.dump(concept_map, f, indent=2)
    print(f"  ✓ Written: {OUTPUT_CONCEPT_MAP}")
    
    # Step 5: Generate markdown files
    print("\n[5/5] Generating concept markdown files...")
    generator = ConceptContentGenerator(pdf_loader)
    generate_markdown_files(concept_chunk_map, generator, OUTPUT_CONCEPTS_DIR)
    
    print("\n" + "=" * 60)
    print("Generation complete!")
    print(f"- Concept map: {OUTPUT_CONCEPT_MAP}")
    print(f"- Markdown files: {OUTPUT_CONCEPTS_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
```

---

## Alternative: LLM-Enhanced Version

If you want higher quality content using LLM:

```python
# Add to generate_concepts.py

import openai

class LLMContentGenerator(ConceptContentGenerator):
    """Uses LLM to transform PDF text into structured markdown"""
    
    def __init__(self, pdf_loader: PdfIndexLoader, api_key: str):
        super().__init__(pdf_loader)
        self.client = openai.OpenAI(api_key=api_key)
    
    def generate_with_llm(
        self,
        concept: ConceptInfo,
        raw_text: str
    ) -> str:
        """Use LLM to generate structured markdown from raw PDF text"""
        
        prompt = f"""Transform this textbook excerpt about "{concept.title}" into structured markdown.

Raw textbook content:
{raw_text[:2000]}  # Limit to avoid token overflow

Generate markdown with this exact structure:

# {concept.title}

## Definition
[Clear one-sentence definition]

## Explanation
[2-3 paragraphs explaining the concept]

## Examples
### Example 1: [Title]
```sql
[Working SQL code]
```
[Explanation]

### Example 2: [Title]
```sql
[Working SQL code]
```
[Explanation]

### Example 3: [Title]
```sql
[Working SQL code]
```
[Explanation]

## Common Mistakes

### Mistake 1: [Title]
**Incorrect:**
```sql
[Wrong code]
```

**Correct:**
```sql
[Right code]
```

**Why this happens:** [Explanation]

### Mistake 2: [Title]
[Same structure]

### Mistake 3: [Title]
[Same structure]

Use only information from the textbook content provided."""

        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert SQL educator. Transform textbook excerpts into clear, structured learning materials."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        return response.choices[0].message.content
```

---

## Usage Instructions

1. **Save the script** to your helper project as `generate_concepts.py`

2. **Install dependencies**:
```bash
pip install openai  # Only if using LLM version
```

3. **Run the generator**:
```bash
python generate_concepts.py
```

4. **Verify output**:
```bash
ls -la "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/public/textbook-static/concepts/"
```

5. **Rebuild the app**:
```bash
cd "/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts"
npm run build
```

---

## Path Quick Reference

| Purpose | Absolute Path |
|---------|---------------|
| **PDF Chunks (Input)** | `/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/dist/pdf-index/chunks.json` |
| **Concept Registry (Input)** | `/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/src/app/data/concept-registry.json` |
| **Raw PDF (Input)** | `/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/textbooks/murachs-mysql-3rd-edition.pdf` |
| **Concept Map (Output)** | `/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/public/textbook-static/concept-map.json` |
| **Concept Markdown (Output)** | `/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/public/textbook-static/concepts/{concept-id}.md` |
