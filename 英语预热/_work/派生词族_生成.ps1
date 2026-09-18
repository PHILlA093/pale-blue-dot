# Stage2: word families & candidate derivational chains from root tags + suffix rules.
$ErrorActionPreference = 'Stop'
$root = 'E:\workspace\穷观\英语预热'
$enc = New-Object System.Text.UTF8Encoding($false)

$words = [System.IO.File]::ReadAllText((Join-Path $root '高考英语3500词根版_全量.json'), $enc) | ConvertFrom-Json
$byNo = @{}; $byWord = @{}
foreach ($w in $words) { $byNo[[int]$w.no] = $w; $byWord[([string]$w.word).ToLowerInvariant()] = $w }

# root families from existing root index json (tag/mean/words)
$idx = [System.IO.File]::ReadAllText((Join-Path $root '词根检索索引.json'), $enc) | ConvertFrom-Json
$families = @($idx | Where-Object { $_.type -eq '词根' })
Write-Output ('root families=' + $families.Count)

# suffix inventory for concat-edge detection
$suffixes = @('ation','tion','sion','ion','al','ial','ive','ity','ty','ment','er','or','ance','ence','ancy','ency','ous','ly','ful','less','ing','ed','ist','ism','ize','ise','able','ible','ness','ant','ent','ate','ure','ary','ic','ical','y','fy','ify','dom','hood','ship','cy','ee','en','ess','et','ish','some','ward','wise','eer')
# manual known derivational chains (word pairs, lower)
$ovPairs = @(
  @('accept','acceptable'),@('act','action'),@('act','active'),@('act','activity'),@('act','actor'),@('act','actress'),@('actual','actually'),
  @('admire','admirable'),@('admit','admission'),@('advertise','advertisement'),@('advise','advice'),
  @('agriculture','agricultural'),@('analyze','analysis'),@('announce','announcement'),@('apply','application'),@('apply','applicant'),
  @('appreciate','appreciation'),@('argue','argument'),@('arrange','arrangement'),@('arrive','arrival'),@('assist','assistant'),
  @('associate','association'),@('assume','assumption'),@('attract','attraction'),@('attract','attractive'),
  @('behave','behaviour'),@('believe','belief'),@('benefit','beneficial'),@('breathe','breath'),
  @('celebrate','celebration'),@('choose','choice'),@('collect','collection'),@('communicate','communication'),@('compete','competition'),
  @('complete','completion'),@('conclude','conclusion'),@('confident','confidence'),@('congratulate','congratulation'),
  @('connect','connection'),@('consider','consideration'),@('construct','construction'),@('contain','container'),
  @('contribute','contribution'),@('convenient','convenience'),@('converse','conversation'),@('convince','convincing'),
  @('create','creation'),@('create','creative'),@('create','creature'),@('decide','decision'),@('decorate','decoration'),
  @('deep','depth'),@('describe','description'),@('develop','development'),@('die','death'),@('differ','difference'),@('different','difference'),
  @('direct','direction'),@('direct','director'),@('discover','discovery'),@('discuss','discussion'),@('distance','distant'),
  @('distribute','distribution'),@('divide','division'),@('educate','education'),@('elect','election'),@('employ','employment'),
  @('encourage','encouragement'),@('enjoy','enjoyment'),@('enter','entrance'),@('entertain','entertainment'),@('equal','equality'),
  @('equip','equipment'),@('excite','excitement'),@('excite','exciting'),@('exhibit','exhibition'),@('exist','existence'),
  @('expect','expectation'),@('explain','explanation'),@('explore','exploration'),@('express','expression'),
  @('fail','failure'),@('fair','fairness'),@('familiar','familiarize'),@('fancy','fantasy'),@('fasten','fast'),
  @('favour','favourite'),@('final','finally'),@('fortune','fortunate'),@('free','freedom'),@('frequent','frequency'),
  @('friend','friendship'),@('frighten','fright'),@('generate','generation'),@('gentle','gentleman'),@('gift','gifted'),
  @('govern','government'),@('graduate','graduation'),@('grateful','gratitude'),@('grow','growth'),@('happy','happiness'),
  @('hate','hatred'),@('healthy','health'),@('hero','heroine'),@('history','historical'),@('hope','hopeful'),
  @('humour','humorous'),@('identify','identity'),@('imagine','imagination'),@('impress','impression'),@('improve','improvement'),
  @('include','inclusion'),@('independence','independent'),@('influence','influential'),@('inform','information'),
  @('injure','injury'),@('inspire','inspiration'),@('instruct','instruction'),@('insure','insurance'),
  @('intelligent','intelligence'),@('intend','intention'),@('interest','interesting'),@('introduce','introduction'),
  @('invent','invention'),@('invite','invitation'),@('judge','judgement'),@('kind','kindness'),@('know','knowledge'),
  @('laugh','laughter'),@('learn','learned'),@('liberate','liberation'),@('liberty','liberate'),@('literate','literature'),
  @('lonely','loneliness'),@('major','majority'),@('manage','management'),@('marry','marriage'),@('mean','meaning'),
  @('measure','measurement'),@('medal','medalist'),@('medicine','medical'),@('memorize','memory'),@('mercy','merciful'),
  @('mix','mixture'),@('mother','motherland'),@('motivate','motivation'),@('move','movement'),@('nation','national'),
  @('nature','natural'),@('necessary','necessity'),@('negotiate','negotiation'),@('nervous','nerve'),@('noise','noisy'),
  @('observe','observation'),@('occupy','occupation'),@('operate','operation'),@('oppose','opposite'),@('organize','organization'),
  @('origin','original'),@('patience','patient'),@('perform','performance'),@('permit','permission'),@('person','personal'),
  @('please','pleasure'),@('poison','poisonous'),@('polite','politeness'),@('pollute','pollution'),@('popular','population'),
  @('possible','possibility'),@('practise','practice'),@('predict','prediction'),@('prepare','preparation'),@('present','presentation'),
  @('press','pressure'),@('prevent','prevention'),@('produce','product'),@('produce','production'),@('progress','progressive'),
  @('pronounce','pronunciation'),@('protect','protection'),@('proud','pride'),@('prove','proof'),@('publish','publication'),
  @('punish','punishment'),@('qualify','qualification'),@('real','reality'),@('receive','reception'),@('recommend','recommendation'),
  @('reduce','reduction'),@('reflect','reflection'),@('refuse','refusal'),@('relax','relaxation'),@('rely','reliable'),
  @('remain','remainder'),@('remove','removal'),@('represent','representative'),@('require','requirement'),@('resist','resistance'),
  @('resolve','resolution'),@('respond','response'),@('responsible','responsibility'),@('restrict','restriction'),
  @('satisfy','satisfaction'),@('science','scientist'),@('select','selection'),@('separate','separation'),@('serve','service'),
  @('settle','settlement'),@('sign','signal'),@('significant','significance'),@('similar','similarity'),@('simple','simplify'),
  @('society','social'),@('solve','solution'),@('speak','speech'),@('special','specialist'),@('strong','strength'),
  @('succeed','success'),@('suffer','suffering'),@('suggest','suggestion'),@('survive','survival'),@('sympathy','sympathetic'),
  @('system','systematic'),@('terrify','terror'),@('thank','thankful'),@('think','thought'),@('tour','tourist'),
  @('translate','translation'),@('treat','treatment'),@('true','truth'),@('understand','understanding'),@('unite','union'),
  @('use','useful'),@('value','valuable'),@('vary','variety'),@('violate','violence'),@('volunteer','voluntary'),
  @('wide','width'),@('willing','willingness'),@('wonder','wonderful'),@('worth','worthy'),@('young','youth')
)

$out = New-Object System.Collections.ArrayList
foreach ($fam in $families) {
  $tag = [string]$fam.tag; $mean = [string]$fam.mean
  $members = New-Object System.Collections.ArrayList
  foreach ($wn in @($fam.words)) {
    $lo = ([string]$wn).ToLowerInvariant()
    if ($byWord.ContainsKey($lo)) { $w = $byWord[$lo]; [void]$members.Add([pscustomobject]@{ no = [int]$w.no; word = $w.word; pos = [string]$w.pos }) }
  }
  if ($members.Count -eq 0) { continue }
  # edges: manual pairs both in family; plus suffix concat edges
  $edges = @{}
  $mems = @($members | Sort-Object { [int]$_.no })
  $names = @{}; foreach ($m in $mems) { $names[[string]$m.word] = $true }
  foreach ($pair in $ovPairs) {
    $a = [string]$pair[0]; $b = [string]$pair[1]
    if ($names.ContainsKey($a) -and $names.ContainsKey($b)) {
      if (-not $edges.ContainsKey($a)) { $edges[$a] = New-Object 'System.Collections.Generic.HashSet[string]' }
      [void]$edges[$a].Add($b)
    }
  }
  foreach ($a in $names.Keys) {
    $al = $a.ToLowerInvariant()
    foreach ($s in $suffixes) {
      if ($al.Length -gt $s.Length -and $al.EndsWith($s)) {
        $stem = $al.Substring(0, $al.Length - $s.Length)
        foreach ($cand in @($stem, ($stem + 'e'), ($stem + 'y'))) {
          if ($cand.Length -ge 2 -and $names.ContainsKey($cand)) {
            if (-not $edges.ContainsKey($cand)) { $edges[$cand] = New-Object 'System.Collections.Generic.HashSet[string]' }
            if ($cand -ne $al) { [void]$edges[$cand].Add($a) }
          }
        }
      }
    }
  }
  # components
  $seen = @{}
  $chains = New-Object System.Collections.ArrayList
  $allNames = @($names.Keys)
  foreach ($start in ($allNames | Sort-Object { $_.Length })) {
    if ($seen.ContainsKey($start)) { continue }
    # BFS forward from start
    $comp = New-Object 'System.Collections.Generic.HashSet[string]'
    $q = New-Object System.Collections.Queue; $q.Enqueue($start); [void]$comp.Add($start)
    while ($q.Count -gt 0) {
      $cur = $q.Dequeue()
      if ($edges.ContainsKey($cur)) { foreach ($nx in $edges[$cur]) { if (-not $comp.Contains($nx)) { [void]$comp.Add($nx); $q.Enqueue($nx) } } }
    }
    # also add reverse edges partners
    foreach ($k in $edges.Keys) { foreach ($v in $edges[$k]) { if ($comp.Contains($v) -and -not $comp.Contains($k)) { [void]$comp.Add($k) } } }
    $compList = @($comp | Sort-Object { $_.Length } )
    if ($compList.Count -ge 2) {
      $chainWords = New-Object System.Collections.ArrayList
      foreach ($cn in $compList) { $w = $byWord[$cn]; [void]$chainWords.Add([pscustomobject]@{ no = [int]$w.no; word = $w.word; pos = [string]$w.pos }) }
      [void]$chains.Add([pscustomobject]@{ chain = @($chainWords) })
      foreach ($cn in $compList) { $seen[$cn] = $true }
    }
  }
  [void]$out.Add([pscustomobject]@{ root = $tag; mean = $mean; count = $members.Count; words = @($mems); chains = @($chains) })
}
$chainTotal = 0; foreach ($f in $out) { $chainTotal += @($f.chains).Count }
Write-Output ('families with members=' + $out.Count + ' chainsTotal=' + $chainTotal)
# Write outputs
$jsonPath = Join-Path $root '词汇细分类\派生词族.json'
$payload = [ordered]@{ meta = [ordered]@{ title = '派生词族与词性链(基于词根族)'; source = 'AI整理初版(规则+种子链),待人工校对'; base = '全量表 no 1-3640' }; families = @($out) }
[System.IO.File]::WriteAllText($jsonPath, ($payload | ConvertTo-Json -Depth 6), $enc)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('派生词族表（AI整理初版·待人工校对；root｜含义｜词族(no word pos)；chain=候选派生链）')
foreach ($f in ($out | Sort-Object root)) {
  [void]$sb.AppendLine(''); [void]$sb.AppendLine(('== {0}｜{1}（{2}词） ==' -f $f.root, $f.mean, $f.count))
  foreach ($m in $f.words) { [void]$sb.AppendLine(('  {0:D4} {1} [{2}]' -f [int]$m.no, $m.word, $m.pos)) }
  foreach ($c in $f.chains) {
    $ws = @($c.chain | ForEach-Object { $_.word })
    [void]$sb.AppendLine(('  → ' + ($ws -join ' → ')))
  }
}
[System.IO.File]::WriteAllText((Join-Path $root '词汇细分类\派生词族.txt'), $sb.ToString(), $enc)
Write-Output 'word-family files written'
