# otoge-flow-flow.com release 手順

## docker 上でのビルドと起動し、問題ないか確認

一度 Docker Desktop 上で該当 Container を削除

開発者用 PowerShell 上で作業フォルダを \repos\PopnScoreTool2 にする。

    > docker compose build

    > docker compose up -d

テスト

## ECR の登録

### arm 用ビルド

    > cd PopnScoreTool2\Proxy1
    > docker buildx build --platform linux/arm64 .　-t pst2_proxy:latest
    > cd PopnScoreTool2\
    > docker buildx build --platform linux/arm64 .　-t pst2_web:latest --no-cache

### まずは認証

PowerShell 7 上で

    PS> (Get-ECRLoginCommand).Password | docker login --username AWS --password-stdin {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com

    Login Succeeded

### upload する container image を確認

    PS> docker image ls

    REPOSITORY                                                                TAG           IMAGE ID       CREATED         SIZE
    popnscoretool2_web.pst2                                                   latest       57a96a9c7e21   2 minutes ago       183MB
    popnscoretool2_proxy.pst2                                                 latest       a3d0f9c1cdea   7 minutes ago       28.6MB

#### step 4: tag 付け

    docker tag {IMAGE ID} {aws_account_id}.dkr.ecr.{region}.amazonaws.com/{ecr_repository_name}

    docker tag 57a96a9c7e21 {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com/ym_web_pst2
    docker tag a3d0f9c1cdea {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com/ym_proxy_pst2

    docker tag d0d3c9bb63e5 {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com/ym_web_pst2
    docker tag c7c89bfffedd {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com/ym_proxy_pst2

#### step 5: image の push

    docker push {aws_account_id}.dkr.ecr.{region}.amazonaws.com/{ecr_repository_name}

    docker push {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com/ym_web_pst2
    docker push {aws_account_id}.dkr.ecr.ap-northeast-1.amazonaws.com/ym_proxy_pst2

#### step 6: AWS MC で該当するクラスターのタスクを終了。再起動まで待つ

TODO : console login 無しでやりたい。