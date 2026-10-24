# Design record schema2

- `schema_version`:2.
- `request`: complete normalized computational input including WT/Mut, initial modules, mode, fixed-arm setting, ligation conditions and readout temperature/salt.
- `request_sha256`: SHA256 of sorted, compact JSON for that request.
- `software`: name, application/algorithm version, source-file hashes, aggregate source hash, optional local commit and Python version. Source hashes identify uncommitted source accurately; commit alone does not.
- `input`: normalized ligation/arm inputs used for the legacy view. Use `request`, not `input`, for replay.
- `candidates`:0–3 computed recommendations. Each has `role=computed`, unique ID, matching sequences/modules, arm coordinates, fold data, scores, boundary results and complete-oligo interaction report.
- `reference`: separate original91nt experimental reference. It is not counted as a computed design and is selectable only if `matches_input` is true. Its role is `experimental_reference`.
- `selection`: explicit selected ID/role, or null values for a server/CLI record with no user selection.
- `counts`: named stages. `arms_enumerated`, `thermal_pass`, `boundary_pass`, `interaction_pass`, `structure_evaluated`, optional joint-stage counts, `selected`. These counts are not interchangeable. A fixed-arm mode records whether a thermal filter was applied.
- `models`, `ranking`, `limitations`, `boundary_rule`, optional `joint_design`: numerical model/settings, bounded rules and exact candidate-pool seed.
- `context`: optional browser metadata such as target name and catalog provenance. User-entered names do not alter biological calculations.
- `created_utc`: execution time; it is not used in scoring or source/request hashes.

Coordinates: target arm intervals are1-based inclusive; module ranges are0-based half-open. DNA sequences use T, RNA crRNA uses U and includes the fixed handle.5′ phosphorylation is required for the padlock; plain copied sequence excludes ordering modification codes.

Schema1 browser records sometimes appended the reference to `candidates`. They are retained only as historical artifacts. Replay intentionally requires schema2 complete requests; old records must not be silently presented as fully reproducible schema2 records.
