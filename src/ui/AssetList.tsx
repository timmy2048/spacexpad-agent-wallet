import { buildAssetGroups } from '../../shared/assets.ts';
import { chainName, clusterLabel, t } from '../../shared/i18n.ts';
import { displayAmount } from '../../shared/money.ts';
import type { Lang, Snapshot } from '../../shared/types.ts';

export function AssetList({
  lang,
  snapshots,
  onRefresh,
}: {
  lang: Lang;
  snapshots: Snapshot[];
  onRefresh: (() => void) | null;
}) {
  const groups = buildAssetGroups(snapshots);
  return (
    <section className="block">
      <div className="block-head">
        <h2>{t(lang, 'assets')}</h2>
        {onRefresh ? (
          <button type="button" className="text-action" onClick={onRefresh}>
            {t(lang, 'refresh')}
          </button>
        ) : null}
      </div>
      {groups.map((group) => (
        <div className="chain" key={group.chain}>
          {group.clusters.map((cluster) => (
            <div key={`${group.chain}:${cluster.network ?? 'unread'}`}>
              <h3>
                {chainName(lang, group.chain)}
                {cluster.network ? ` · ${clusterLabel(lang, group.chain, cluster.network)}` : ''}
              </h3>
              {cluster.status === 'error' ? <p className="error">{cluster.error}</p> : null}
              {cluster.status !== 'error'
                ? cluster.assets.map((asset) => (
                    <div className="asset" key={`${asset.native ? 'native' : asset.contract}`}>
                      <span>{asset.symbol}</span>
                      <span className="amt">
                        {displayAmount(asset.amount)}
                        {asset.usd ? <span className="usd"> ${asset.usd}</span> : null}
                      </span>
                    </div>
                  ))
                : null}
              {cluster.status === 'unread' ? <p className="note">{t(lang, 'notReadYet')}</p> : null}
              {cluster.tokenListError ? <p className="error">{cluster.tokenListError}</p> : null}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
