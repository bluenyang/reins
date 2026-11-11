// A git hook runs with GIT_INDEX_FILE (and friends) pointing at the commit being made. The tests run git in
// temporary repositories of their own, so they must not inherit them.
for (const k of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_PREFIX']) delete process.env[k];
