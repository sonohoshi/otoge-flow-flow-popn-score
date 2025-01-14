/* eslint-disable camelcase */
/* eslint-disable no-undef */
import * as site from './site_m.js';
import * as otoge from './const_m.js';

const PAGE_NAME = 'targetMedal';

let mainGrid;
let medal_rate_data_raw;
let fumens_data_raw;
let target_medal_key;

let updateFilterTimer;

let sort_click_count;
let sort_target;

let initializing = true;

const fumenFilter = (version, target, medal, rank, lv, lv_type) => {
  const res = alasql(`MATRIX OF
SELECT TBL1.[1] AS [0], TBL1.[2] AS [1], -- genre/title
TBL1.[3] AS [2], TBL1.[4] AS [3], -- lv-type/lv
TBL2.[1] AS [4], -- medal
TBL2.[2] AS [5], TBL2.[3] AS [6], -- rank/score
TBL1.[5] AS [7], -- version
TBL2.[4] AS [8], -- count
TBL2.[5] AS [9], (TBL2.[5] - TBL2.[3]) AS [10], -- avg/diff
TBL2.[6] AS [11], TBL2.[7] AS [12], TBL2.[8] AS [13], TBL2.[9] AS [14], TBL2.[10] AS [15], TBL2.[11] AS [16], TBL2.[12] AS [17],
TBL2.[13] AS [18] -- count now
FROM ? AS TBL1 INNER JOIN ? AS TBL2 ON TBL2.[0] = TBL1.[0]`, [fumens_data_raw, medal_rate_data_raw]);

  const data = res.map((a) => [a[1], a[0],
    a[2], a[3],
    a[4],
    a[11], a[12], a[13], a[14], a[15], a[16], a[17],
    a[8],
    a[18], a[7], a[5],
  ]);

  let sql = 'MATRIX OF SELECT * FROM ?';
  let arg = [data];
  if (version[0] !== 0) {
    sql += (arg.length === 1) ? ' WHERE' : ' AND';
    sql += ' [14] = ?';
    arg = arg.concat([otoge.VERSION_DATA_R[version[0]]]);
  }
  if (medal[0] !== 0 || medal[1] !== otoge.MEDAL_DATA.length - 1) {
    sql += (arg.length === 1) ? ' WHERE' : ' AND';
    sql += ' ? <= [4] AND [4] <= ?';

    if (target[0] === otoge.TARGET_MEDAL_DATA.length - 1) {
      // next
      arg = arg.concat([otoge.MEDAL_DATA_R[medal[0]], otoge.MEDAL_DATA_R[medal[1]]]);
    } else {
      // fix target/固定ターゲットの場合は終わっているものをフィルタする。
      arg = arg.concat([otoge.MEDAL_DATA_R[medal[0]],
        otoge.MEDAL_DATA_R[medal[1]] < (otoge.TARGET_MEDAL_DATA_R[target[0]] - 1)
          ? otoge.MEDAL_DATA_R[medal[1]] : (otoge.TARGET_MEDAL_DATA_R[target[0]] - 1),
      ]);
    }
  }
  if (rank[0] !== 0 || rank[1] !== otoge.RANK_DATA.length - 1) {
    sql += (arg.length === 1) ? ' WHERE' : ' AND';
    sql += ' ? <= [15] AND [15] <= ?';
    arg = arg.concat([otoge.RANK_DATA_R[rank[0]], otoge.RANK_DATA_R[rank[1]]]);
  }
  if (lv[0] !== 0 || lv[1] !== otoge.LV_DATA.length - 1) {
    sql += (arg.length === 1) ? ' WHERE' : ' AND';
    sql += ' ? <= [3] AND [3] <= ?';
    arg = arg.concat([lv[0] + 1, lv[1] + 1]); // +1 == to lv
  }
  if (lv_type[0] !== 0 || lv_type[1] !== otoge.LV_TYPE_DATA.length - 1) {
    sql += (arg.length === 1) ? ' WHERE' : ' AND';
    sql += ' ? <= [2] AND [2] <= ?';
    arg = arg.concat([lv_type[0] + 1, lv_type[1] + 1]); // +1 == to lv type
  }

  const res2 = alasql(sql, arg);

  let res3;
  if (target[0] === otoge.TARGET_MEDAL_DATA.length - 1) {
    const test = `MATRIX OF
    SELECT TBL1.[0], TBL1.[1], TBL1.[2], TBL1.[3], TBL1.[4],
    CASE WHEN TBL1.[4] < 4 THEN TBL1.[5]
    WHEN TBL1.[4] < 5 THEN TBL1.[6]
    WHEN TBL1.[4] < 6 THEN TBL1.[7]
    WHEN TBL1.[4] < 7 THEN TBL1.[8]
    WHEN TBL1.[4] < 8 THEN TBL1.[9]
    WHEN TBL1.[4] < 9 THEN TBL1.[10]
    WHEN TBL1.[4] < 10 THEN TBL1.[11]
    ELSE 'score' END,
    TBL1.[12], TBL1.[13], TBL1.[15]
    FROM ? AS TBL1`;

    res3 = alasql(test, [res2]);
  } else {
    // ${otoge.TARGET_MEDAL_DATA_R[target[0]] + 1} is column number
    const test = `MATRIX OF
SELECT TBL1.[0], TBL1.[1], TBL1.[2], TBL1.[3], TBL1.[4],
CASE WHEN TBL1.[4] < 10 THEN TBL1.[${otoge.TARGET_MEDAL_DATA_R[target[0]] + 1}]
ELSE 'score' END,
TBL1.[12], TBL1.[13], TBL1.[15]
FROM ? AS TBL1`;
    res3 = alasql(test, [res2]);
  }

  sql = 'MATRIX OF SELECT * FROM ?';
  arg = [res3];

  const result = alasql(sql, arg);

  return result;
};

// const onReady = (...args) => {
const onReady = () => {
  // page 移動, sort 変更のタイミングでも呼ばれる。
  // console.log('row: ' + JSON.stringify(args), args);
  const test = site.getCurrentSortStatus();
  // console.log(test);
  if (test[0]) {
    updateGrid2(true);
  }
};

// const storeSort = (...args) => {
const storeSort = () => {
  mainGrid.off('ready', storeSort);

  // console.log('row: ' + JSON.stringify(args), args);

  setTimeout(() => {
    [...Array(sort_click_count)].map(() => $(`.gridjs-th[data-column-id=${sort_target}]`).trigger('click'));
  }, 0);
};

const updateGrid = (data) => {
  if (mainGrid === undefined) {
    mainGrid = new gridjs.Grid({
      columns: [
        {
          id: '0',
          name: 'genre',
          formatter: (_, row) => gridjs.html(`${row.cells[0].data}<br>${row.cells[1].data}`), /*
                          return gridjs.html((row.cells[0].data === row.cells[1].data) ?
                              row.cells[1].data :
                              (row.cells[0].data + ' / ' + row.cells[1].data));
                              */

          attributes: (cell) => {
            if (cell === null) {
              return undefined;
            }
            return {
              colspan: '2',
            };
          },
        },
        {
          id: '1',
          name: 'title',
          attributes: (cell) => {
            if (cell === null) {
              return undefined;
            }
            return {
              style: 'display:none',
            };
          },
        },
        {
          id: '2',
          name: '',
          sort: 0,
          width: '1px',
          attributes: {
            style: 'display:none',
          },
        },
        {
          id: '3',
          name: 'lv',
          attributes: (cell, row) => {
            if (cell === null) {
              return {
                colspan: '2',
              };
            }
            return {
              style: `background-color:${otoge.LV_TYPE_BACK_COLOR[row.cells[2].data]}; padding:0px; text-align: center`,
              colspan: '2',
            };
          },
        },
        {
          id: '4',
          name: 'n→t',
          formatter: (_, row) => {
            let next_medal = otoge.TARGET_MEDAL_DATA_R[target_medal_key];
            if (target_medal_key === String(otoge.TARGET_MEDAL_DATA.length - 1)) {
              if (row.cells[4].data < 4) {
                next_medal = 4;
              } else {
                next_medal = row.cells[4].data + 1;
              }
            }

            return gridjs.html(`<img src="/icon/medal_${row.cells[4].data}.png" alt="${row.cells[4].data}" width="18" height="18" />`
                              + `<img src="/icon/rank_${row.cells[8].data}.png" alt="${row.cells[8].data}" width="18" height="18" />`
                              + `→${(next_medal > 10) ? ('score')
                                : (`<img src="/icon/medal_${next_medal}.png" alt="${next_medal}" width="18" height="18" />`)}`);
          },
          attributes: {
            style: 'padding: 0px; text-align: center',
          },
        },
        {
          id: '5',
          // important!
          name: gridjs.html('target<br>%'),
          formatter: (_, row) => (Number.isFinite(row.cells[5].data)
            ? row.cells[5].data.toFixed(2) : row.cells[5].data),
          sort: {
            compare: (a, b) => {
              const a_is_finite = Number.isFinite(a);
              const b_is_finite = Number.isFinite(b);
              if (!a_is_finite && !b_is_finite) {
                return 0;
              } if (!a_is_finite) {
                return 1;
              } if (!b_is_finite) {
                return -1;
              }
              if (a > b) {
                return 1;
              } if (a < b) {
                return -1;
              }
              return 0;
            },
          },
          attributes: (cell) => {
            if (cell === null) {
              return undefined;
            }
            return {
              style: 'padding:  0px 5px 0px 0px; text-align: right; font-family: monospace',
            };
          },
        },
        {
          id: '6',
          name: 'c',
          formatter: (_, row) => gridjs.html(`${row.cells[6].data}<br><span style='color:gray'>(${row.cells[7].data})</span>`),
          attributes: (cell) => {
            if (cell === null) {
              return {
                colspan: '3',
              };
            }
            return {
              style: 'padding:  0px 5px 0px 0px; text-align: right; font-family: monospace',
              colspan: '2',
            };
          },
        },
        {
          id: '7',
          name: '',
          sort: 0,
          width: '1px',
          attributes: {
            style: 'display:none',
          },
        },
        {
          id: '8',
          name: '',
          sort: 0,
          width: '1px',
          attributes: {
            style: 'display:none',
          },
        },
      ],
      sort: true,
      search: true,
      pagination: {
        enabled: true,
        limit: 10,
      },
      style: {
        table: {
        },
        th: {
          padding: '0px',
          'text-align': 'center',
        },
        td: {
          padding: '0px',
          'text-align': 'center',
        },
      },
      language: {
        pagination: {
          previous: '←',
          next: '→',
        },
      },
      data,
    }).render(document.getElementById('wrapper'));

    mainGrid.on('ready', onReady);

    // 1st sort.
    [sort_target, sort_click_count] = site.getFilterSortStatus(PAGE_NAME, '5', 2);

    if (sort_click_count > 0) {
      mainGrid.on('ready', storeSort);
    }
  } else {
    [sort_target, sort_click_count] = site.getFilterSortStatus(PAGE_NAME, '5', 2);

    mainGrid.updateConfig({
      data,
    }).forceRender();

    if (sort_click_count > 0) {
      mainGrid.on('ready', storeSort);
    }
  }
};

function updateGrid2(filterSaveOnly) {
  let skipSlider;
  let val;

  skipSlider = document.getElementById('skipstep-version');
  val = skipSlider.noUiSlider.get();
  const key_version = Object.keys(otoge.VERSION_DATA).filter(
    (key) => otoge.VERSION_DATA[key] === val,
  )[0];

  skipSlider = document.getElementById('skipstep-target');
  val = skipSlider.noUiSlider.get();
  const key_target = Object.keys(otoge.TARGET_MEDAL_DATA).filter(
    (key) => otoge.TARGET_MEDAL_DATA[key] === val,
  )[0];

  // for column
  target_medal_key = key_target;

  skipSlider = document.getElementById('skipstep-medal');
  val = skipSlider.noUiSlider.get();
  const key_medal1 = Object.keys(otoge.MEDAL_DATA).filter(
    (key) => otoge.MEDAL_DATA[key] === val[0],
  )[0];
  const key_medal2 = Object.keys(otoge.MEDAL_DATA).filter(
    (key) => otoge.MEDAL_DATA[key] === val[1],
  )[0];

  skipSlider = document.getElementById('skipstep-rank');
  val = skipSlider.noUiSlider.get();
  const key_rank1 = Object.keys(otoge.RANK_DATA).filter(
    (key) => otoge.RANK_DATA[key] === val[0],
  )[0];
  const key_rank2 = Object.keys(otoge.RANK_DATA).filter(
    (key) => otoge.RANK_DATA[key] === val[1],
  )[0];

  skipSlider = document.getElementById('skipstep-lv');
  val = skipSlider.noUiSlider.get();
  const key_lv1 = Object.keys(otoge.LV_DATA).filter((key) => otoge.LV_DATA[key] === val[0])[0];
  const key_lv2 = Object.keys(otoge.LV_DATA).filter((key) => otoge.LV_DATA[key] === val[1])[0];

  skipSlider = document.getElementById('skipstep-lv-type');
  val = skipSlider.noUiSlider.get();
  const key_lv_type1 = Object.keys(otoge.LV_TYPE_DATA).filter(
    (key) => otoge.LV_TYPE_DATA[key] === val[0],
  )[0];
  const key_lv_type2 = Object.keys(otoge.LV_TYPE_DATA).filter(
    (key) => otoge.LV_TYPE_DATA[key] === val[1],
  )[0];

  if (filterSaveOnly) {
    // save filter & sort
    const sortStatus = site.getCurrentSortStatus();

    const selectedFilter = window.localStorage.getItem(`${PAGE_NAME}.selectedFilter`) ?? '0';
    const prevFilters = JSON.parse(window.localStorage.getItem(`${PAGE_NAME}.filters`)) ?? {};
    prevFilters[selectedFilter] = {
      version: key_version,
      target: key_target,
      medal: [key_medal1, key_medal2],
      rank: [key_rank1, key_rank2],
      lv: [key_lv1, key_lv2],
      lv_type: [key_lv_type1, key_lv_type2],
      sort: sortStatus,
    };

    window.localStorage.setItem(`${PAGE_NAME}.filters`, JSON.stringify(prevFilters));
  } else {
    const filteredData = fumenFilter(
      [key_version].map(Number),
      [key_target].map(Number),
      [key_medal1, key_medal2].map(Number),
      [key_rank1, key_rank2].map(Number),
      [key_lv1, key_lv2].map(Number),
      [key_lv_type1, key_lv_type2].map(Number),
    );

    updateGrid(filteredData);
  }
}

if (document.querySelector('h1.nologin') !== null) {
  // no login
} else {
  document.getElementById('filter-selection').addEventListener('click', ({ target }) => {
    if (initializing === false && target.children[0].getAttribute('name') === 'btnradio') {
      // change filter
      const selectedFilter = target.children[0].id.replace('btnradio', '');
      window.localStorage.setItem(`${PAGE_NAME}.selectedFilter`, selectedFilter);
      // load filter
      const prevFilters = JSON.parse(window.localStorage.getItem(`${PAGE_NAME}.filters`));
      const prevFilter = (prevFilters === null
        || !Object.prototype.hasOwnProperty.call(prevFilters, selectedFilter))
        ? null
        : prevFilters[selectedFilter];

      Array.from(document.querySelectorAll('[id^=skipstep-]')).map(
        (skipSlider) => {
          if (skipSlider.noUiSlider !== undefined) {
            if (prevFilter === null) {
              skipSlider.noUiSlider.set(skipSlider.noUiSlider.options.default);
            } else {
              const filter = prevFilter[skipSlider.id.replace('skipstep-', '').replaceAll('-', '_')];
              const table = skipSlider.noUiSlider.options.matchingTable;
              if (Array.isArray(filter)) {
                skipSlider.noUiSlider.set([table[filter[0]], table[filter[1]]]);
              } else {
                skipSlider.noUiSlider.set(table[filter]);
              }
            }
          }

          return undefined;
        },
      );

      // change filter で local storage は更新しない。
      if (prevFilters === null) {
        window.localStorage.removeItem(`${PAGE_NAME}.filters`);
      } else {
        window.localStorage.setItem(`${PAGE_NAME}.filters`, JSON.stringify(prevFilters));
      }

      updateGrid2();
    }
  });

  document.getElementById('reset-button').addEventListener('click', () => {
    Array.from(document.querySelectorAll('[id^=skipstep-]')).map(
      (skipSlider) => skipSlider.noUiSlider.set(skipSlider.noUiSlider.options.default),
    );

    // remove filter
    const selectedFilter = window.localStorage.getItem(`${PAGE_NAME}.selectedFilter`) ?? '0';
    const prevFilters = JSON.parse(window.localStorage.getItem(`${PAGE_NAME}.filters`));
    if (prevFilters !== null) {
      if (Object.prototype.hasOwnProperty.call(prevFilters, selectedFilter)) {
        delete prevFilters[selectedFilter];
        if (Object.keys(prevFilters).length === 0) {
          window.localStorage.removeItem(`${PAGE_NAME}.filters`);
        } else {
          window.localStorage.setItem(`${PAGE_NAME}.filters`, JSON.stringify(prevFilters));
        }
      }
    }

    updateGrid2();
  });

  {
    // load filter
    const selectedFilter = window.localStorage.getItem(`${PAGE_NAME}.selectedFilter`) ?? '0';
    document.getElementById(`btnradio${selectedFilter}`).parentNode.click();
    const prevFilters = JSON.parse(window.localStorage.getItem(`${PAGE_NAME}.filters`));
    const prevFilter = (prevFilters === null
      || !Object.prototype.hasOwnProperty.call(prevFilters, selectedFilter))
      ? null
      : prevFilters[selectedFilter];

    {
      const skipSlider = document.getElementById('skipstep-version');
      const defaultPos = otoge.VERSION_DATA[0];
      const startPos = (prevFilter !== null && prevFilter.version !== undefined)
        ? otoge.VERSION_DATA[prevFilter.version]
        : defaultPos;

      noUiSlider.create(skipSlider, {
        range: {
          min: 0,
          max: otoge.VERSION_DATA.length - 1,
        },
        start: startPos,
        default: defaultPos,
        matchingTable: otoge.VERSION_DATA,
        step: 1,
        tooltips: true,
        format: {
          to: (key) => otoge.VERSION_DATA[Math.round(key)],
          from: (value) => Object.keys(otoge.VERSION_DATA).filter(
            (key) => otoge.VERSION_DATA[key] === value,
          )[0],
        },
      });

      const skipValues = [
        document.getElementById('version-text'),
      ];

      skipSlider.noUiSlider.on('update', (values, handle) => {
        skipValues[handle].innerHTML = values[handle];
      });

      skipSlider.noUiSlider.on('start', () => {
        clearTimeout(updateFilterTimer);
      });

      skipSlider.noUiSlider.on('set', () => {
        if (fumens_data_raw !== undefined && mainGrid !== undefined) {
          updateGrid2(true);
          clearTimeout(updateFilterTimer);
          updateFilterTimer = setTimeout(() => {
            updateGrid2();
          }, 1000);
        }
      });
    }
    {
      const skipSlider = document.getElementById('skipstep-target');
      const defaultPos = otoge.TARGET_MEDAL_DATA[otoge.TARGET_MEDAL_DATA.length - 1];
      const startPos = (prevFilter !== null && prevFilter.target !== undefined)
        ? otoge.TARGET_MEDAL_DATA[prevFilter.target]
        : defaultPos;

      noUiSlider.create(skipSlider, {
        range: {
          min: 0,
          max: otoge.TARGET_MEDAL_DATA.length - 1,
        },
        start: startPos,
        default: defaultPos,
        matchingTable: otoge.TARGET_MEDAL_DATA,
        step: 1,
        tooltips: true,
        format: {
          to: (key) => otoge.TARGET_MEDAL_DATA[Math.round(key)],
          from: (value) => Object.keys(otoge.TARGET_MEDAL_DATA).filter(
            (key) => otoge.TARGET_MEDAL_DATA[key] === value,
          )[0],
        },
      });

      const skipValues = [
        document.getElementById('target-text'),
      ];

      skipSlider.noUiSlider.on('update', (values, handle) => {
        skipValues[handle].innerHTML = values[handle];
      });

      skipSlider.noUiSlider.on('start', () => {
        clearTimeout(updateFilterTimer);
      });

      skipSlider.noUiSlider.on('set', () => {
        if (fumens_data_raw !== undefined && mainGrid !== undefined) {
          updateGrid2(true);
          clearTimeout(updateFilterTimer);
          updateFilterTimer = setTimeout(() => {
            updateGrid2();
          }, 1000);
        }
      });
    }
    {
      const skipSlider = document.getElementById('skipstep-medal');
      const defaultPos = [otoge.MEDAL_DATA[0],
        otoge.MEDAL_DATA[otoge.MEDAL_DATA.length - 2]]; // default without perfect
      const startPos = (prevFilter !== null
        && prevFilter.medal !== undefined && prevFilter.medal.length === 2)
        ? [otoge.MEDAL_DATA[prevFilter.medal[0]], otoge.MEDAL_DATA[prevFilter.medal[1]]]
        : defaultPos;

      noUiSlider.create(skipSlider, {
        range: {
          min: 0,
          max: otoge.MEDAL_DATA.length - 1,
        },
        connect: true,
        start: startPos,
        default: defaultPos,
        matchingTable: otoge.MEDAL_DATA,
        step: 1,
        tooltips: [true, true],
        format: {
          to: (key) => otoge.MEDAL_DATA[Math.round(key)],
          from: (value) => Object.keys(otoge.MEDAL_DATA).filter(
            (key) => otoge.MEDAL_DATA[key] === value,
          )[0],
        },
      });

      const skipValues = [
        document.getElementById('medal-lower'),
        document.getElementById('medal-upper'),
        document.getElementById('medal-hyphen'),
        document.getElementById('medal-same'),
      ];

      skipSlider.noUiSlider.on('update', (values, handle) => {
        skipValues[handle].innerHTML = values[handle];

        if (skipValues[0].innerHTML === skipValues[1].innerHTML) {
          skipValues[3].innerHTML = values[handle];
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else if ((skipValues[0].innerText === otoge.MEDAL_DATA[0]
                  || skipValues[0].innerHTML === otoge.MEDAL_DATA[0])
                  && (skipValues[1].innerText === otoge.MEDAL_DATA[otoge.MEDAL_DATA.length - 1]
                      || skipValues[1].innerHTML === otoge.MEDAL_DATA[
                        otoge.MEDAL_DATA.length - 1])) {
          skipValues[3].innerHTML = 'ALL';
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else {
          skipValues[0].style.display = 'inline';
          skipValues[1].style.display = 'inline';
          skipValues[2].style.display = 'inline';
          skipValues[3].style.display = 'none';
        }
      });

      skipSlider.noUiSlider.on('start', () => {
        clearTimeout(updateFilterTimer);
      });

      skipSlider.noUiSlider.on('set', () => {
        if (fumens_data_raw !== undefined && mainGrid !== undefined) {
          updateGrid2(true);
          clearTimeout(updateFilterTimer);
          updateFilterTimer = setTimeout(() => {
            updateGrid2();
          }, 1000);
        }
      });
    }
    {
      const skipSlider = document.getElementById('skipstep-rank');
      const defaultPos = [otoge.RANK_DATA[0], otoge.RANK_DATA[otoge.RANK_DATA.length - 1]];
      const startPos = (prevFilter !== null
        && prevFilter.rank !== undefined && prevFilter.rank.length === 2)
        ? [otoge.RANK_DATA[prevFilter.rank[0]], otoge.RANK_DATA[prevFilter.rank[1]]]
        : defaultPos;

      noUiSlider.create(skipSlider, {
        range: {
          min: 0,
          max: otoge.RANK_DATA.length - 1,
        },
        connect: true,
        start: startPos,
        default: defaultPos,
        matchingTable: otoge.RANK_DATA,
        step: 1,
        tooltips: [true, true],
        format: {
          to: (key) => otoge.RANK_DATA[Math.round(key)],
          from: (value) => Object.keys(otoge.RANK_DATA).filter(
            (key) => otoge.RANK_DATA[key] === value,
          )[0],
        },
      });

      const skipValues = [
        document.getElementById('rank-lower'),
        document.getElementById('rank-upper'),
        document.getElementById('rank-hyphen'),
        document.getElementById('rank-same'),
      ];

      skipSlider.noUiSlider.on('update', (values, handle) => {
        skipValues[handle].innerHTML = values[handle];

        if (skipValues[0].innerHTML === skipValues[1].innerHTML) {
          skipValues[3].innerHTML = values[handle];
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else if ((skipValues[0].innerText === otoge.RANK_DATA[0]
                  || skipValues[0].innerHTML === otoge.RANK_DATA[0])
                  && (skipValues[1].innerText === otoge.RANK_DATA[otoge.RANK_DATA.length - 1]
                      || skipValues[1].innerHTML === otoge.RANK_DATA[otoge.RANK_DATA.length - 1])) {
          skipValues[3].innerHTML = 'ALL';
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else {
          skipValues[0].style.display = 'inline';
          skipValues[1].style.display = 'inline';
          skipValues[2].style.display = 'inline';
          skipValues[3].style.display = 'none';
        }
      });

      skipSlider.noUiSlider.on('start', () => {
        clearTimeout(updateFilterTimer);
      });

      skipSlider.noUiSlider.on('set', () => {
        if (fumens_data_raw !== undefined && mainGrid !== undefined) {
          updateGrid2(true);
          clearTimeout(updateFilterTimer);
          updateFilterTimer = setTimeout(() => {
            updateGrid2();
          }, 1000);
        }
      });
    }
    {
      const skipSlider = document.getElementById('skipstep-lv');
      const defaultPos = [otoge.LV_DATA[0], otoge.LV_DATA[otoge.LV_DATA.length - 1]];
      const startPos = (prevFilter !== null
        && prevFilter.lv !== undefined && prevFilter.lv.length === 2)
        ? [otoge.LV_DATA[prevFilter.lv[0]], otoge.LV_DATA[prevFilter.lv[1]]]
        : defaultPos;

      noUiSlider.create(skipSlider, {
        range: {
          min: 0,
          max: otoge.LV_DATA.length - 1,
        },
        connect: true,
        start: startPos,
        default: defaultPos,
        matchingTable: otoge.LV_DATA,
        step: 1,
        tooltips: [true, true],
        format: {
          to: (key) => otoge.LV_DATA[Math.round(key)],
          from: (value) => Object.keys(otoge.LV_DATA).filter(
            (key) => otoge.LV_DATA[key] === value,
          )[0],
        },
      });

      const skipValues = [
        document.getElementById('lv-lower'),
        document.getElementById('lv-upper'),
        document.getElementById('lv-hyphen'),
        document.getElementById('lv-same'),
      ];

      skipSlider.noUiSlider.on('update', (values, handle) => {
        skipValues[handle].innerHTML = values[handle];

        if (skipValues[0].innerHTML === skipValues[1].innerHTML) {
          skipValues[3].innerHTML = values[handle];
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else if (skipValues[0].innerText === otoge.LV_DATA[0]
                  && skipValues[1].innerText === otoge.LV_DATA[otoge.LV_DATA.length - 1]) {
          skipValues[3].innerHTML = 'ALL';
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else {
          skipValues[0].style.display = 'inline';
          skipValues[1].style.display = 'inline';
          skipValues[2].style.display = 'inline';
          skipValues[3].style.display = 'none';
        }
      });

      skipSlider.noUiSlider.on('start', () => {
        clearTimeout(updateFilterTimer);
      });

      skipSlider.noUiSlider.on('set', () => {
        if (fumens_data_raw !== undefined && mainGrid !== undefined) {
          updateGrid2(true);
          clearTimeout(updateFilterTimer);
          updateFilterTimer = setTimeout(() => {
            updateGrid2();
          }, 1000);
        }
      });
    }
    {
      const skipSlider = document.getElementById('skipstep-lv-type');
      const defaultPos = [otoge.LV_TYPE_DATA[0], otoge.LV_TYPE_DATA[otoge.LV_TYPE_DATA.length - 1]];
      const startPos = (prevFilter !== null
        && prevFilter.lv_type !== undefined && prevFilter.lv_type.length === 2)
        ? [otoge.LV_TYPE_DATA[prevFilter.lv_type[0]], otoge.LV_TYPE_DATA[prevFilter.lv_type[1]]]
        : defaultPos;

      noUiSlider.create(skipSlider, {
        range: {
          min: 0,
          max: otoge.LV_TYPE_DATA.length - 1,
        },
        connect: true,
        start: startPos,
        default: defaultPos,
        matchingTable: otoge.LV_TYPE_DATA,
        step: 1,
        tooltips: [true, true],
        format: {
          to: (key) => otoge.LV_TYPE_DATA[Math.round(key)],
          from: (value) => Object.keys(otoge.LV_TYPE_DATA).filter(
            (key) => otoge.LV_TYPE_DATA[key] === value,
          )[0],
        },
      });

      const skipValues = [
        document.getElementById('lv-type-lower'),
        document.getElementById('lv-type-upper'),
        document.getElementById('lv-type-hyphen'),
        document.getElementById('lv-type-same'),
      ];

      skipSlider.noUiSlider.on('update', (values, handle) => {
        skipValues[handle].innerHTML = values[handle];

        if (skipValues[0].innerHTML === skipValues[1].innerHTML) {
          skipValues[3].innerHTML = values[handle];
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else if (skipValues[0].innerText === otoge.LV_TYPE_DATA[0]
                  && skipValues[1].innerText === otoge.LV_TYPE_DATA[
                    otoge.LV_TYPE_DATA.length - 1]) {
          skipValues[3].innerHTML = 'ALL';
          skipValues[0].style.display = 'none';
          skipValues[1].style.display = 'none';
          skipValues[2].style.display = 'none';
          skipValues[3].style.display = 'inline';
        } else {
          skipValues[0].style.display = 'inline';
          skipValues[1].style.display = 'inline';
          skipValues[2].style.display = 'inline';
          skipValues[3].style.display = 'none';
        }
      });

      skipSlider.noUiSlider.on('start', () => {
        clearTimeout(updateFilterTimer);
      });

      skipSlider.noUiSlider.on('set', () => {
        if (fumens_data_raw !== undefined && mainGrid !== undefined) {
          updateGrid2(true);
          clearTimeout(updateFilterTimer);
          updateFilterTimer = setTimeout(() => {
            updateGrid2();
          }, 1000);
        }
      });
    }
  }

  $.getJSON('/api/medalrate', (medal_rate_data) => {
    $.getJSON('/api/fumens', (fumens_data) => {
      medal_rate_data_raw = medal_rate_data;
      fumens_data_raw = fumens_data;

      updateGrid2();
    });
  });

  initializing = false;
}
