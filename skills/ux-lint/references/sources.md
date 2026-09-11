# Sources index

The primary research behind each principle in `principles.md`. Cross-checked in September 2026 against the origin sections of lawsofux.com; contested claims were checked against the primary papers.

Use this when a user asks "where does that come from?". Cite the primary source, not a blog.

## Primary sources by principle

| Principle | Primary source(s) | Evidence |
|---|---|---|
| Aesthetic-Usability Effect | Kurosu & Kashimura (1995), CHI, 26 ATM layouts, 252 participants · Tractinsky (1997), CHI · Ashby, Isen & Turken (1999), *Psychological Review* | moderate |
| Choice Overload | Toffler (1970), *Future Shock* · Iyengar & Lepper (2000), *JPSP* · Scheibehenne, Greifeneder & Todd (2010), *J. Consumer Research*, meta-analysis · Chernev, Böckenholt & Goodman (2015), *J. Consumer Psychology*, meta-analysis | mixed |
| Chunking | Miller (1956), *Psychological Review* · Chase & Simon (1973), *Cognitive Psychology* | strong |
| Cognitive Bias | Tversky & Kahneman (1972 onward; 1974, *Science*) | strong (varies by bias) |
| Cognitive Load | Sweller (1988), *Cognitive Science* | moderate |
| Doherty Threshold | Doherty & Thadani (1982), *IBM Systems Journal* · Miller (1968), AFIPS · Card, Robertson & Mackinlay (1991), CHI · Myers (1985), CHI, progress indicators · Buell & Norton (2011), *Management Science*, labor illusion | moderate |
| Fitts's Law | Fitts (1954), *J. Experimental Psychology* · MacKenzie (1992), *Human–Computer Interaction* · Hoober (2013), UXmatters, mobile grip | strong |
| Flow | Csikszentmihalyi (1975, 1990) | moderate / heuristic |
| Goal-Gradient Effect | Hull (1932, 1934) · Kivetz, Urminsky & Zheng (2006), *J. Marketing Research* · Nunes & Drèze (2006), *J. Consumer Research*, endowed progress | moderate |
| Hick's Law | Hick (1952), *QJEP* · Hyman (1953), *J. Experimental Psychology* · Larson & Czerwinski (1998), CHI, menu breadth vs depth | strong (original conditions) |
| Jakob's Law | Nielsen (2000), "End of Web Design", NN/g | heuristic |
| Law of Common Region | Palmer (1992), *Cognitive Psychology* | strong |
| Law of Proximity | Wertheimer (1923) | strong |
| Law of Prägnanz | Wertheimer (1912, 1923) | strong |
| Law of Similarity | Wertheimer (1923) | strong |
| Law of Uniform Connectedness | Palmer & Rock (1994), *Psychonomic Bulletin & Review* | strong |
| Mental Model | Craik (1943), *The Nature of Explanation* · Norman (1988), *The Design of Everyday Things* · Jones et al. (2011), *Ecology and Society* | heuristic |
| Miller's Law | Miller (1956) · Cowan (2001), *Behavioral and Brain Sciences* · Cowan (2010), *Current Directions in Psychological Science* | mixed (as applied) |
| Occam's Razor | William of Ockham (14th c.), principle of parsimony | heuristic |
| Paradox of the Active User | Carroll & Rosson (1987), in *Interfacing Thought* (MIT Press) | moderate |
| Pareto Principle | Pareto (1896) · Juran (1950s), quality management | heuristic |
| Parkinson's Law | Parkinson (1955), *The Economist* (humorous essay) | heuristic |
| Peak-End Rule | Kahneman, Fredrickson, Schreiber & Redelmeier (1993), *Psychological Science* · Redelmeier & Kahneman (1996), *Pain* · Do, Rupert & Wolford (2008), *Psychonomic Bulletin & Review* · Baumeister et al. (2001), *Review of General Psychology* | moderate |
| Postel's Law | Postel (1980), RFC 760/761 · Thomson & Schinazi (2023), RFC 9413 (critique for protocols) | heuristic |
| Selective Attention | Cherry (1953) · Broadbent (1958) · Treisman (1960) · Kahneman (1973) · Rensink, O'Regan & Clark (1997), change blindness · Benway & Lane (1998), banner blindness · Simons & Chabris (1999), *Perception* | strong |
| Serial Position Effect | Ebbinghaus (1885) · Murdock (1962), *J. Experimental Psychology* | strong (for recall) |
| Tesler's Law | Tesler (mid-1980s), via Saffer (2006), *Designing for Interaction* · Tognazzini (counterpoint) | heuristic |
| Von Restorff Effect | von Restorff (1933), *Psychologische Forschung* | strong |
| Working Memory | Miller, Galanter & Pribram (1960) · Peterson & Peterson (1959) · Atkinson & Shiffrin (1968) · Baddeley & Hitch (1974) · Cowan (2001) | strong |
| Zeigarnik Effect | Zeigarnik (1927) · Ovsiankina (1928) · Ghibellini & Meier (2025), *Humanities and Social Sciences Communications*, meta-analysis, doi:10.1057/s41599-025-05000-w | mixed (memory) / strong (resumption) |

## Deliberate divergences from common framings

Popular UX references (including lawsofux.com and many blog summaries) sometimes state these principles more strongly or more loosely than the research supports. ux-lint takes the positions below on purpose, and a review should explain them if a user pushes back.

1. **Zeigarnik effect.** It is commonly stated that people *remember* unfinished tasks better. The 2025 meta-analysis found no general memory advantage, but a reliable tendency to *resume* interrupted tasks. **ux-lint** designs for resumption (save and resume, visible remaining steps) and does not claim a memory effect.

2. **"Artificial progress".** Some guides recommend artificial progress to boost completion. The research (Kivetz et al. 2006; Nunes & Drèze 2006) supports an *honest, visible head start*. **ux-lint** endorses endowed progress and flags misrepresented progress as a dark pattern (blocker).

3. **Artificial delay.** Some guides say a purposeful delay can increase perceived value and trust. That is true in a narrow form: Buell & Norton (2011) show that *showing real work* during one-off, high-value waits can increase perceived value. **ux-lint** allows operational transparency for one-off results, and flags delays on frequent interactions or fabricated "work".

4. **Miller's Law.** Commonly used to cap menus or lists at 7 items. It concerns memory span, not visible options, and the modern estimate is about 4 chunks. **ux-lint** never flags visible item counts under Miller's Law.

5. **Choice Overload.** Often stated as a general rule. Meta-analyses show the effect is conditional (average near zero; appears with unclear preferences, hard comparisons, complex sets). **ux-lint** cites it only with its conditions.

6. **Hick's Law for navigation.** Often used to argue for fewer menu items. Research on menus favours broad, well-organised structures over deep ones. **ux-lint** checks grouping and labelling before recommending cuts.
