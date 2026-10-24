# Computational methods — 0.2.0-rc.1

Padlock Lab performs a bounded heuristic search, not an exhaustive optimum or a prediction of assay performance. Coordinates are 1-based on the supplied target in the interface; implementation slices are 0-based, end-exclusive. The supplied WT and mutant fragment must differ by one base. No genome-wide alignment is performed.

## Reference and inputs

The study WT78/Mut79 record is a 50 nt experimental fragment, separate from the 61 nt genomic reference entry. The original reference padlock is 91 nt (18 nt 5′ arm, 11 nt 3′ arm, 62 nt backbone). It uses the original primer and full LbaCas12a crRNA. A reference is shown only as a matching reference, never counted as a newly recommended design. Automatic recommendations require experimental validation.

Catalog records are maintained in analysis/m1/catalog; analysis.catalog generates the browser catalog and checks identifiers and WT/alternate bases. These records are supplied local fragments, not reference-genome accessions. Readers should verify biological context before ordering.

## Recognition-arm search

The unlocked search enumerates 5′ arms of 16–26 nt and 3′ arms of 9–17 nt within the available flanks. Perfect-match Tm uses Biopython DNA_NN4 with Owczarzy2008 salt correction, user probe concentration (dnac1) and dnac2=0. Tm5 must exceed Tm3. Automatic designs must have zero contiguous complementary extension from Spacer1/3 at both intended arm boundaries on both supplied WT and mutant fragments. This local rule does not exclude all other possible interactions. The original experimental reference is exempt, with its actual extension displayed.

For ligation temperature t and requested arm-Tm difference d, reference temperatures are left=t+d, right=t. The thermal penalty is |Tm5−left| + 1.5|Tm3−right| + 0.5|(Tm5−Tm3)−d| + 3 max(0,t−Tm5). The best 24 thermal candidates proceed to structural assessment. A structure penalty is five times the mean of arm, junction, primer-site and most-paired activator-site pairing penalties. Distinct balanced, anchoring and discrimination roles are selected; one role's Tm deviation does not determine every rank. The anchoring/discrimination role references shift the left/right references by +2/−2 °C respectively.

With fixed original arms, only compatible inputs can use the fixed-arm path. Same-composition linker-B shuffles are assessed across ligation temperature ±5 °C (bounded to 10–80 °C); the worst structural score is used. Strict boundary/interaction screening may return fewer than three or zero computational designs. No rule is silently relaxed to fill the table.

## Joint primer/crRNA design

Joint design seeds from up to three arm designs and uses deterministic SHA-derived random proposals (WT, mutant and fixed seed 20261023; at most 8000 attempts). Primer lengths are 19–24 nt and guide spacer lengths 20–24 nt, with 35–65% GC and no four-base homopolymers. The first 16 passing primers and guides are retained; up to eight of each are combined per arm seed. This bounded pool is not a global search.

Primer Tm uses a fixed 500 nM reference, readout monovalent salt and a window of readout temperature +5 to +25 °C. A −7 kcal/mol dimer threshold is an engineering filter; hairpin risk contributes a soft penalty. Full crRNA includes the fixed LbaCas12a handle; its spacer mean unpaired probability in the free-RNA model must be at least 0.45. A 16 nt exact guide-target match against either supplied strand is excluded. Primer-target screening also covers both strands.

Let R=(2−mean arm openness−junction openness)/2 and D=(2−primer-site openness−activator-site openness)/2. Primer quality is |Tm−(readout+15)|/10 + max(0,−hairpin MFE)/3 + max(0,−dimer energy)/7. Guide quality is 1−full-crRNA spacer openness. Let q=0.1 primer quality+0.2 guide quality. Scores are R+D+q+arm-Tm deviation/40 (balanced), R+q (recognition), and D+q (readout). Three distinct matched primer/guide pairs are selected when available, with sequence tie-breaking. Exact implementation and source checksums are included in the release/export.

## Unintended complementarity

Exact reverse-complement screening covers full crRNA versus primer, padlock and unintended RCA sequence; primer versus padlock outside its intended site, RCA, WT and mutant in both orientations. Two units allow screening across circular/RCA junctions. Intended primer/activator sites are masked only in their corresponding checks. Matches of at least 8 nt reject computational candidates; 6–7 nt matches remain explicit review flags. These engineering cutoffs are not experimentally calibrated interference or safety thresholds. Shorter interactions, mismatches and mixed DNA/RNA binding energetics are not exhaustively modeled.

## Structure models and stage conditions

Pinned engines: Biopython 1.87, ViennaRNA 2.7.2, numpy 2.4.6. DNA uses Mathews2004; free RNA uses Turner2004. Temperature and monovalent salt are explicit, dangles=2, base-pair probabilities enabled; the DNA engine's noGU flag is false. Ligase-stage DNA folding uses ligation conditions. Primer/guide selection and readout-stage DNA folds use the independently specified readout temperature/salt. Nominal Mg can enter the arm-Tm salt calculation, but ViennaRNA folding here has no independent Mg term. Do not interpret its salt reference as a full experimental buffer.

Mean per-base openness is not the probability that the entire site is simultaneously open. RCA folding uses one reverse-complement unit; two units are used for exact junction screening only. Models omit ligase and polymerase kinetics, RNP-bound guide structure, surface/tether effects, cooling schedules and genome-wide specificity. They cannot establish circularization yield, LOD, background, cleavage activity or a validated optimal design.

## Reproducibility

Schema2 JSON preserves the complete normalized request, separate reference, selected role, source/model versions, seed, conditions and named filter counts. Run analysis.replay with the same source and pinned dependencies. Installation, examples and commands are in README. Candidate sequence agreement verifies computational replay; it does not validate experimental performance.

## Dependency references

- Cock et al. (2009), Biopython. Bioinformatics 25, 1422–1423. https://doi.org/10.1093/bioinformatics/btp163
- Lorenz et al. (2011), ViennaRNA Package 2.0. Algorithms for Molecular Biology 6, 26. https://doi.org/10.1186/1748-7188-6-26
- Engine parameter names and the precise Tm implementation are recorded in each result. Consult the pinned engines for the underlying Mathews2004, Turner2004 and Owczarzy2008 parameter references.

## Reader catalog and ordering representation

For duplicate HGVS entries, the displayed catalog prefers the study fragment; the original genomic JSON source is preserved. Only the exact study fragment/allele displays the experimental reference. This presentation rule does not alter the backend arm-match assessment. Human-facing padlock sequences and FASTA include IDT `/5Phos/`; computational JSON retains raw ACGT for reproducibility. No invented3′-OH modification code is added: ordinary terminal3′-OH remains unmodified. Source: https://www.idtdna.com/pages/Support/FAQs/do-custom-oligos-come-with-5-phosphorylation- .

Length guidance reports algorithm search ranges (5′arm16–26nt,3′arm9–17nt, new primer19–24nt, guide20–24nt). Linker A/B/C5/10/5nt are study starting lengths, not established universal optima. Readout37°C is the study setting;151mM is a configurable monovalent-ion model reference rather than a universal reaction recipe.
