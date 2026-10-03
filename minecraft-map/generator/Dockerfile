# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:25-jre-jammy@sha256:6a11121e5419a1eb4def2bba2f74a4c1b560395b9c26b52e37485d2bf58f7958 AS bluemap-java

FROM eclipse-temurin:21.0.8_9-jre-jammy

COPY --from=bluemap-java /opt/java/openjdk /opt/java25

ARG CHUNKER_URL=https://github.com/HiveGamesOSS/Chunker/releases/download/1.19.1/chunker-cli-1.19.1.jar
ARG CHUNKER_SHA256=327662e8632acdb4571f60939206d605418ac0633741e1e5a58f5d6c6866dc74
ARG PAPER_URL=https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar
ARG PAPER_SHA256=5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc
ARG DYNMAP_URL=https://dynmap.us/builds/dynmap/Dynmap-3.7-beta-8-spigot.jar
ARG DYNMAP_SHA256=87c6035c2cb73bf22fc34ca738cb21a2db89ab5f30bd1071cd8090802a1c78bc

ARG BLUEMAP_URL=https://github.com/BlueMap-Minecraft/BlueMap/releases/download/v5.28/bluemap-5.28-cli.jar
ARG BLUEMAP_SHA256=c6868465f8f972a64a3f2acc32112cab8560339045747f81359bdea6959f7ac2

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --location --retry 5 --output /opt/chunker.jar "$CHUNKER_URL" \
    && curl --fail --location --retry 5 --header "User-Agent: pmc-website-map-generator/1.0 (local project)" --output /opt/paper.jar "$PAPER_URL" \
    && curl --fail --location --retry 5 --output /opt/dynmap.jar "$DYNMAP_URL" \
    && curl --fail --location --retry 5 --output /opt/bluemap.jar "$BLUEMAP_URL" \
    && echo "$CHUNKER_SHA256  /opt/chunker.jar" | sha256sum --check \
    && echo "$PAPER_SHA256  /opt/paper.jar" | sha256sum --check \
    && echo "$DYNMAP_SHA256  /opt/dynmap.jar" | sha256sum --check \
    && echo "$BLUEMAP_SHA256  /opt/bluemap.jar" | sha256sum --check \
    && useradd --create-home --uid 10001 mapgen \
    && mkdir -p /input /work /output \
    && chown -R mapgen:mapgen /input /work /output

COPY --chmod=755 render-map.sh /usr/local/bin/render-map
COPY --chmod=644 render-log.sh /usr/local/lib/render-log.sh
COPY --chmod=644 map-storage.sh /usr/local/lib/map-storage.sh
COPY --chmod=755 extract_archive.py /usr/local/bin/extract_archive.py
COPY --chmod=755 update_catalog.py /usr/local/bin/update_catalog.py
COPY --chmod=755 render-bluemap.sh /usr/local/bin/render-bluemap
COPY --chmod=644 bluemap-embed.js bluemap-embed.css /usr/local/share/bluemap/
RUN chmod 755 /usr/local/share/bluemap

USER mapgen
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/render-map"]
