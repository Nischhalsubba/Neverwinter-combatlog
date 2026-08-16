// Anonymized capture contract derived from a saved NW-Hub Party Overview and
// Damage Out screenshot for combatlog_2026-08-13_00-00-00.log. Character and
// account identifiers are intentionally not stored in the repository.

export const capturedPartyOverview = Object.freeze([
  { id: 'P01', damage: 2308559306.1609983, hits: 5197, duration: 2262.5, expected: { damage: '2.3B', dps: '1.0M', combatDps: '1.6M', hits: '5,197', duration: '37m 42s' } },
  { id: 'P02', damage: 2216463064.3020067, hits: 2858, duration: 2290.0999999046326, expected: { damage: '2.2B', dps: '967.8K', combatDps: '1.5M', hits: '2,858', duration: '38m 10s' } },
  { id: 'P03', damage: 1817179912.8080013, hits: 4685, duration: 2083.7000000476837, expected: { damage: '1.8B', dps: '872.1K', combatDps: '1.3M', hits: '4,685', duration: '34m 43s' } },
  { id: 'P04', damage: 1492598065.7199993, hits: 2695, duration: 846.7000000476837, expected: { damage: '1.5B', dps: '1.8M', combatDps: '1.8M', hits: '2,695', duration: '14m 6s' } },
  { id: 'P05', damage: 1363800283.7780004, hits: 2713, duration: 2250.4000000953674, expected: { damage: '1.4B', dps: '606.0K', combatDps: '862.3K', hits: '2,713', duration: '37m 30s' } },
  { id: 'P06', damage: 1269681736.3210988, hits: 2897, duration: 2298.9000000953674, expected: { damage: '1.3B', dps: '552.3K', combatDps: '905.4K', hits: '2,897', duration: '38m 18s' } },
  { id: 'P07', damage: 907393764.7079998, hits: 776, duration: 481.2000000476837, expected: { damage: '907.4M', dps: '1.9M', combatDps: '1.8M', hits: '776', duration: '8m 1s' } },
  { id: 'P08', damage: 183012140.58590618, hits: 1833, duration: 2301.4000000953674, expected: { damage: '183.0M', dps: '79.5K', combatDps: '113.6K', hits: '1,833', duration: '38m 21s' } },
  { id: 'P09', damage: 126006619.59000015, hits: 1490, duration: 2300, expected: { damage: '126.0M', dps: '54.8K', combatDps: '78.2K', hits: '1,490', duration: '38m 20s' } },
  { id: 'P10', damage: 81531104.98000002, hits: 708, duration: 1774.7000000476837, expected: { damage: '81.5M', dps: '45.9K', combatDps: '66.2K', hits: '708', duration: '29m 34s' } },
  { id: 'P11', damage: 46101103.56999988, hits: 3047, duration: 1782.5, expected: { damage: '46.1M', dps: '25.9K', combatDps: '37.4K', hits: '3,047', duration: '29m 42s' } },
  { id: 'P12', damage: 664902, hits: 3, duration: 1.9000000953674316, expected: { damage: '664.9K', dps: '349.9K', combatDps: '229.3K', hits: '3', duration: '1s' } },
  { id: 'P13', damage: 585400, hits: 6, duration: 2.0999999046325684, expected: { damage: '585.4K', dps: '278.8K', combatDps: '201.9K', hits: '6', duration: '2s' } },
  { id: 'P14', damage: 47965.1, hits: 2, duration: 0.20000004768371582, expected: { damage: '48.0K', dps: '239.8K', combatDps: '16.5K', hits: '2', duration: '0s' } },
  { id: 'P15', damage: 23354.2, hits: 2, duration: 0, expected: { damage: '23.4K', dps: '23.4M', combatDps: '8.1K', hits: '2', duration: '0s' } }
]);

export const capturedDamageOut = Object.freeze([
  { power: 'Thorn Strike', hits: 103, damage: 344356972, share: 14.916531322413626, avg: 3343271.572815534, max: 10664300, crit: 86.40776699029125, expected: ['103','344.4M','14.9%','3.3M','10.7M','86.4%'] },
  { power: 'Hindering Strike', hits: 182, damage: 337669124, share: 14.626833415058519, avg: 1855324.857142857, max: 9478860, crit: 82.96703296703298, expected: ['182','337.7M','14.6%','1.9M','9.5M','83.0%'] },
  { power: 'Throw Caution', hits: 113, damage: 271501261, share: 11.760636180124436, avg: 2402666.0265486725, max: 7703710, crit: 85.84070796460178, expected: ['113','271.5M','11.8%','2.4M','7.7M','85.8%'] },
  { power: 'Infernal Pounce', hits: 21, damage: 218317569, share: 9.45687504831962, avg: 10396074.714285715, max: 37393300, crit: 57.14285714285714, expected: ['21','218.3M','9.5%','10.4M','37.4M','57.1%'] },
  { power: 'Thorn Ward', hits: 167, damage: 129803667, share: 5.622713120411711, avg: 777267.4670658683, max: 2964030, crit: 91.01796407185628, expected: ['167','129.8M','5.6%','777.3K','3.0M','91.0%'] },
  { power: 'Rapid Strike', hits: 330, damage: 126208152, share: 5.466965984507321, avg: 382448.94545454544, max: 1049620, crit: 89.39393939393939, expected: ['330','126.2M','5.5%','382.4K','1.0M','89.4%'] },
  { power: 'Tail Sting', hits: 495, damage: 122745103.19999996, share: 5.316956894822773, avg: 247969.90545454537, max: 3009910, crit: 87.67676767676768, expected: ['495','122.7M','5.3%','248.0K','3.0M','87.7%'] },
  { power: 'Forest Ghost', hits: 77, damage: 103881477, share: 4.499840083066739, avg: 1349110.0909090908, max: 3189130, crit: 88.31168831168831, expected: ['77','103.9M','4.5%','1.3M','3.2M','88.3%'] },
  { power: 'Demon Slayer', hits: 1119, damage: 100541244.64999995, share: 4.3551510408105685, avg: 89849.1909294012, max: 825423, crit: 0, expected: ['1,119','100.5M','4.4%','89.8K','825.4K','0.0%'] },
  { power: 'Grasping Roots', hits: 132, damage: 85731075, share: 3.713618046164292, avg: 649477.8409090909, max: 2081580, crit: 89.39393939393939, expected: ['132','85.7M','3.7%','649.5K','2.1M','89.4%'] },
  { power: 'Split the Sky', hits: 130, damage: 85637488, share: 3.7095641325502795, avg: 658749.9076923077, max: 2084650, crit: 90.76923076923077, expected: ['130','85.6M','3.7%','658.7K','2.1M','90.8%'] },
  { power: 'Blade Storm', hits: 419, damage: 58275300.80599999, share: 2.5243146515871175, avg: 139081.86349880666, max: 1807770, crit: 0, expected: ['419','58.3M','2.5%','139.1K','1.8M','0.0%'] }
]);
