package db

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

// NewDBDriver creates new db driver based on profile.
func NewDBDriver(profile *profile.Profile) (store.Driver, error) {
	var driver store.Driver
	var err error

	if profile.Driver != "sqlite" {
		return nil, errors.Errorf("unsupported db driver %q", profile.Driver)
	}
	driver, err = sqlite.NewDB(profile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create db driver")
	}
	return driver, nil
}
