# 
The enhanced functionality of OIlDBIvlSs raises several irnp1ernentation chal-

## Definition

Storage and access methods in ORDBMSs are crucial for efficiently handling large ADT (Abstract Data Type) and structured objects, which can be larger than a single disk page.

## Explanation

When working with object-relational databases, we need to store new types of data that were not present before. This requires revisiting storage and indexing issues from earlier chapters. Specifically, ORDBMSs must efficiently store ADT and structured objects while providing indexed access for quick retrieval. Large ADTs like BLOBs require special storage, often in a different location on disk from the tuples that contain them. Disk-based pointers are maintained to link these large objects with their containing tuples. Structured objects can also be large and vary in size during the database's lifetime, requiring flexible disk layout mechanisms.

## Examples

### Basic Usage

```sql
-- Inserting a large BLOB into an ORDBMS INSERT INTO media (id, content_type, data) VALUES (1, 'image/jpeg', ?);
```

This example demonstrates how to insert a large binary object (BLOB) into an ORDBMS. The BLOB is stored separately from the tuple containing its metadata.

### Practical Example

```sql
-- Retrieving a large BLOB FROM an ORDBMS SELECT data FROM media WHERE id = 1;
```

This practical example shows how to retrieve a large BLOB stored in the database. Efficient storage and access methods are crucial for handling such large objects.

## Common Mistakes

### Forgetting to use disk-based pointers

**Incorrect:**

```sql
-- Incorrectly storing a large object without pointers INSERT INTO media (id, data) VALUES (1, ?);
```

**Correct:**

```sql
-- Correctly using disk-based pointers INSERT INTO media (id, pointer) VALUES (1, 'path_to_large_object');
```

**Why this happens:** This mistake can lead to inefficient data retrieval as the database won't know where to find the large object.

---

## Practice

**Question:** Explain how you would store and retrieve a large video file in an ORDBMS.

**Solution:** To store a large video file, use disk-based pointers to link the tuple containing metadata with the actual file stored on disk. When retrieving the video, follow the pointer to access the file. This ensures efficient storage and quick retrieval.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*