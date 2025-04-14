const fs = require('fs');

async function downloadArtifact({ github, context, core }, artifactIdInput) {
  let artifactId = artifactIdInput;

  if (!artifactId) {
    const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: context.payload.workflow_run.id,
    });

    if (artifacts.data.artifacts.length === 0) {
      core.setFailed('Không tìm thấy artifact nào.');
      return;
    }

    artifactId = artifacts.data.artifacts[0].id;
    console.log("🟢 Tự động chọn Artifact ID:", artifactId);
  } else {
    console.log("🔵 Artifact ID được nhập thủ công:", artifactId);
  }

  const download = await github.rest.actions.downloadArtifact({
    owner: context.repo.owner,
    repo: context.repo.repo,
    artifact_id: artifactId,
    archive_format: 'zip',
  });

  fs.writeFileSync('artifact.zip', Buffer.from(download.data));
  console.log("✅ Artifact đã tải thành công!");
}

module.exports = downloadArtifact;
