# force

`boot/deploy`'s child built into a folder that is there already, what it holds kept.

A deploy refuses a position whose folder exists: `in the way`. With
`--flags force`, where that folder holds no mrepo, the child is built
into it and what is there stays: how a component takes over a position
prepared for it (the schema registry, its skeleton mounted there by the
warm boot). A folder that holds an mrepo is refused all the same. A
deploy that then fails leaves the folder as it found it.

## Declaration

An `option`, `step`: asked of the one command it is written on, not
carried down a chain; it takes no value.
