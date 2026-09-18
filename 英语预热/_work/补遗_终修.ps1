# Final polish of supplementary rows: renames, fills, tail-stripping, dedupe, renumber.
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$enc = New-Object System.Text.UTF8Encoding($false)
$p = Join-Path $root '补遗_词条.json'
$arr = [System.IO.File]::ReadAllText($p, $enc) | ConvertFrom-Json

$remove = @('a','e-mail/email','spaghettiv','taxipayer','tiresomev')
$FIX = @{
  'acute'      = @('acute','ˈækjuːt','adj.','十分严重的；（病）急性的')
  'ambassador' = @('ambassador','æmˈbæsədə(r)','n.','大使，使节')
  'ballpoint'  = @('ballpoint','ˈbɔːlpɔɪnt','n.','圆珠笔')
  'best-seller'= @('best-seller','ˌbestˈselə(r)','n.','畅销书')
  'bike'       = @('bike','baɪk','n.','自行车')
  'boat-race'  = @('boat-race','ˈbəʊtreɪs','n.','划船比赛')
  'cassette'   = @('cassette','kəˈset','n.','磁带')
  'cold-blooded'=@('cold-blooded','ˌkəʊldˈblʌdɪd','adj.','（动物）冷血的')
  'commercial' = @('commercial','kəˈmɜːʃ(ə)l','adj.','商业的，贸易的')
  'criterion'  = @('criterion','kraɪˈtɪəriən','n.','标准，准则（复 criteria）')
  'dad'        = @('dad','dæd','n.','（口）爸爸')
  'disk'       = @('disk','dɪsk','n.','磁盘；唱片')
  'exam'       = @('exam','ɪɡˈzæm','n.','考试，测试')
  'fridge'     = @('fridge','frɪdʒ','n.','冰箱')
  'get-together'=@('get-together','ˌɡet təˈɡeðə(r)','n.','聚会')
  'good-bye'   = @('good-bye','ˌɡʊdˈbaɪ','int.','再见，再会')
  'gym'        = @('gym','dʒɪm','n.','体操；体育馆；健身房')
  'ice-cream'  = @('ice-cream','ˌaɪsˈkriːm','n.','冰淇淋')
  'kind-hearted'=@('kind-hearted','ˌkaɪndˈhɑːtɪd','adj.','好心的')
  'left-handed'= @('left-handed','ˌleftˈhændɪd','adj.','惯用左手的')
  'left-wing'  = @('left-wing','ˌleftˈwɪŋ','n. adj.','左翼（的）')
  'man-made'   = @('man-made','ˌmænˈmeɪd','adj.','人造的，人工的')
  'mathematics'= @('mathematics','ˌmæθəˈmætɪks','n.','数学')
  'mid-autumn' = @('mid-autumn','ˌmɪdˈɔːtəm','n.','中秋')
  'Miss.'      = @('Miss.','mɪs','n.','小姐（对未婚女子的称呼）')
  'Mom'        = @('mom','mɒm','n.','（美）妈妈')
  'Ms.'        = @('Ms.','mɪz','n.','女士（用在婚姻状况不明的女子姓名前）')
  'night-club' = @('night-club','ˈnaɪtklʌb','n.','夜总会')
  'non-stop'   = @('non-stop','ˌnɒnˈstɒp','adj. adv.','不停的；不断地')
  'non-violent'= @('non-violent','ˌnɒnˈvaɪələnt','adj.','非暴力的')
  'Olympic'    = @('Olympic','əˈlɪmpɪk','adj.','奥林匹克（运动会）的')
  'part-time'  = @('part-time','ˌpɑːtˈtaɪm','adj. adv.','兼职的；部分时间的（地）')
  'pen-friend' = @('pen-friend','ˈpenfrend','n.','笔友')
  'phenomenon' = @('phenomenon','fəˈnɒmɪnən','n.','现象')
  'phone'      = @('phone','fəʊn','n. v.','电话，电话机；打电话')
  'phone-booth'= @('phone-booth','ˈfəʊnbuːθ','n.','公用电话亭')
  'ping-pong'  = @('ping-pong','ˈpɪŋpɒŋ','n.','乒乓球')
  'pop'        = @('pop','pɒp','adj. n.','（口语）流行的；流行音乐（popular 的缩写）')
  'right-handed'=@('right-handed','ˌraɪtˈhændɪd','adj.','惯用右手的')
  'right-wing' = @('right-wing','ˌraɪtˈwɪŋ','n. adj.','右翼（的）')
  'ring-road'  = @('ring-road','ˈrɪŋrəʊd','n.','环形公路')
  'school-leaver'=@('school-leaver','ˌskuːlˈliːvə(r)','n.','（英）学校毕业生')
  'see-saw'    = @('see-saw','ˈsiːsɔː','n.','跷跷板（游戏）')
  'self-service'=@('self-service','ˌselfˈsɜːvɪs','n.','自助；自我服务')
  'shall'      = @('shall','ʃæl, ʃ(ə)l','modal v.','（表示将来）将要，会；……好吗')
  'shy'        = @('shy','ʃaɪ','adj.','害羞的')
  'smoke-free' = @('smoke-free','ˌsməʊkˈfriː','adj.','无烟的，非吸烟的')
  'so-so'      = @('so-so','ˌsəʊˈsəʊ','adj.','一般般的；凑合的')
  'step-mother'= @('step-mother','ˈstepmʌðə(r)','n.','继母')
  'tax-free'   = @('tax-free','ˌtæksˈfriː','adj.','免税的')
  'Tibeta'     = @('Tibetan','tiˈbetən','n.','西藏人；西藏语')
  'toward'     = @('toward(s)','təˈwɔːd','prep.','向，朝，对于')
  'T-shirt'    = @('T-shirt','ˌtiːˈʃɜːt','n.','T恤衫')
  'VCD'        = @('VCD','ˌviːsiːˈdiː','n.','影碟光盘')
  'warm-hearted'=@('warm-hearted','ˌwɔːmˈhɑːtɪd','adj.','热心的')
  'well-known' = @('well-known','ˌwelˈnəʊn','adj.','出名的，众所周知的')
  'woo'        = @('wool','wʊl','n.','羊毛，羊绒')
  'world-famous'=@('world-famous','ˌwɜːldˈfeɪməs','adj.','世界闻名的')
  'X-ray'      = @('X-ray','ˌeksˈreɪ','n.','X射线；X光')
}

$out = @()
foreach ($r in $arr) {
  $k = [string]$r.word
  if ($remove -contains $k) { continue }
  if ($FIX.ContainsKey($k)) {
    $v = $FIX[$k]
    $r.word = $v[0]; $r.ph = $v[1]; $r.pos = $v[2]; $r.def = $v[3]
  }
  $out += $r
}
# renumber 3556...
$n = 3556
$sb = New-Object System.Text.StringBuilder
foreach ($r in ($out | Sort-Object { $_.word.ToLowerInvariant() })) {
  $r.no = $n
  [void]$sb.AppendLine(('{0:D4} {1} /{2}/ {3} {4}　【补遗】' -f $n, $r.word, $r.ph, $r.pos, $r.def))
  $n++
}
[System.IO.File]::WriteAllText($p, ($out | ConvertTo-Json -Depth 4), $enc)
[System.IO.File]::WriteAllText((Join-Path $root '补遗_词条.txt'), $sb.ToString(), $enc)
Write-Output ('buyi final count=' + $out.Count + ' no=' + 3556 + '..' + ($n - 1))
