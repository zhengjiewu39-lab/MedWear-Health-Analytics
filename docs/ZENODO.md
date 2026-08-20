# Zenodo DOI Setup (one-time)

MedWear uses [Zenodo](https://zenodo.org) for an archival DOI linked to GitHub releases.

## 1. Connect GitHub

1. Sign in at https://zenodo.org (use **Sign in with GitHub**).
2. Open **Account → GitHub** (https://zenodo.org/account/settings/github/).
3. Click **Sync** / authorize Zenodo on GitHub if prompted.
4. Find **`zhengjiewu39-lab/MedWear-Health-Analytics`** and toggle **ON**.

## 2. Publish release v1.0.0

After the Git tag `v1.0.0` exists on GitHub:

1. Open https://github.com/zhengjiewu39-lab/MedWear-Health-Analytics/releases
2. Confirm release **v1.0.0** is listed (or create it from the tag).
3. Zenodo will automatically ingest the release (usually within a few minutes).
4. Open your Zenodo **Uploads** page — a new deposit appears (may be **restricted** until you publish).

## 3. Publish on Zenodo

1. Review metadata (pre-filled from `.zenodo.json` and GitHub).
2. Click **Publish** on the Zenodo deposit.
3. Copy the DOI (format `10.5281/zenodo.XXXXXXXX`).

## 4. Update repository files

Replace `XXXXXXXX` in:

- `CITATION.cff` → uncomment `identifiers` and set the DOI
- `docs/CODE_AVAILABILITY.md` → DOI links and BibTeX
- Optional: add Zenodo badge to `README.md`:

```markdown
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXXX)
```

## 5. Paper Code Availability

Use the English paragraph in [`docs/CODE_AVAILABILITY.md`](CODE_AVAILABILITY.md) with your real DOI.

## Re-releases

Each new GitHub release tag creates a **new Zenodo version**; the **concept DOI** (without version suffix) always resolves to the latest version.
