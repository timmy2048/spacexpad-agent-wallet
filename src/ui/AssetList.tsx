import { buildAssetGroups } from '../../shared/assets.ts';
import { chainName, clusterLabel, t } from '../../shared/i18n.ts';
import { displayAmount } from '../../shared/money.ts';
import type { Lang, Snapshot } from '../../shared/types.ts';

export function AssetList({
  lang,
  snapshots,
  pending,
  walletsReady,
  onRefresh,
}: {
  lang: Lang;
  snapshots: Snapshot[];
  pending: boolean;
  walletsReady: boolean;
  onRefresh: (() => void) | null;
}) {
  const groups = buildAssetGroups(snapshots);
  return (
    <section className="panel" aria-labelledby="assets-title">
      <div className="panel-head">
        <h2 id="assets-title">{t(lang, 'assets')}</h2>
        {onRefresh ? (
          <button type="button" className="quiet-button" onClick={onRefresh} disabled={pending}>
            {t(lang, 'refresh')}
          </button>
        ) : null}
      </div>
      <p className="note">{t(lang, 'mainnetHint')}</p>
      {groups.map((group) => (
        <section className="chain" key={group.chain}>
          {group.clusters.map((cluster) => {
            const headingId = `${group.chain}-${cluster.network}`;
            return (
              <div key={headingId}>
                <h3 id={headingId}>
                  {chainName(lang, group.chain)}
                  <span className="meta"> {clusterLabel(lang, group.chain, cluster.network)}</span>
                </h3>
                {cluster.network !== 'mainnet' ? <p className="note">{t(lang, 'explicitNetwork')}</p> : null}
                {cluster.status === 'error' ? (
                  <p className="error" role="alert">
                    {cluster.error}
                  </p>
                ) : null}
                {cluster.status === 'absent' ? (
                  <p className="note">{walletsReady || pending ? t(lang, 'readingMainnet') : t(lang, 'walletNotReady')}</p>
                ) : null}
                {cluster.status === 'ready' && pending && cluster.network === 'mainnet' ? (
                  <p className="note">
                    <progress aria-label={t(lang, 'readingMainnet')} /> {t(lang, 'readingMainnet')}
                  </p>
                ) : null}
                {cluster.status === 'absent' && pending ? <progress aria-label={t(lang, 'readingMainnet')} /> : null}
                {cluster.status === 'ready' ? (
                  <ul className="assets" role="list">
                    {cluster.assets.map((asset) => (
                      <li className="asset" key={`${asset.native ? 'native' : asset.contract}`} role="listitem">
                        <span>{asset.symbol}</span>
                        <span className="amt">
                          {displayAmount(asset.amount)}
                          {asset.usd ? <span className="usd"> ${asset.usd}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {cluster.tokenListError ? (
                  <p className="error" role="alert">
                    {cluster.tokenListError}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </section>
  );
}
