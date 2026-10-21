## F-G01 go.sum missing entry
- symptom: `missing go.sum entry for module providing package`
- where: build · test
- cause: dependency added without `go mod tidy`
- fix: `go mod tidy` and commit go.mod + go.sum together
- check: `go build ./...`
- verified: 0
- source: preset
- promoted: no

## F-G02 Race only under -race
- symptom: `WARNING: DATA RACE`
- where: test -race
- cause: shared state without synchronization
- fix: guard with a mutex/channel; add the -race run to the gate if missing
- check: `go test -race ./...`
- verified: 0
- source: preset
- promoted: no
